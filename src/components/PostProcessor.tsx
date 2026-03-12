import { useState, useCallback } from "react";
import { FileCode, Upload, Download, Copy, Check, AlertCircle, Cpu } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMachines } from "@/hooks/useMachines";

// ─── Controller types ────────────────────────────────────────────────
type ControllerType = "fanuc" | "heidenhain" | "siemens" | "okuma" | "mazak";

interface ControllerDef {
  id: ControllerType;
  label: string;
  dialect: string;
  ext: string;
}

const CONTROLLERS: ControllerDef[] = [
  { id: "fanuc",      label: "Fanuc (30i / 31i)",       dialect: "Fanuc G-Code",      ext: "NC" },
  { id: "heidenhain", label: "Heidenhain (TNC / iTNC)", dialect: "Heidenhain Dialog", ext: "H" },
  { id: "siemens",    label: "Siemens (840D / 828D)",   dialect: "DIN/ISO Siemens",   ext: "MPF" },
  { id: "okuma",      label: "Okuma (OSP-P300)",        dialect: "Okuma G-Code",      ext: "MIN" },
  { id: "mazak",      label: "Mazak (Mazatrol ISO)",    dialect: "Mazak ISO G-Code",  ext: "EIA" },
];

// ─── CLS token ───────────────────────────────────────────────────────
interface ClsToken {
  type: string;   // e.g. "GOTO", "CYCLE", "TOOL PATH"
  args: string[]; // split by comma after the "/"
  raw: string;
}

// ─── Robust CLS Parser ────────────────────────────────────────────────
function parseCLS(text: string): ClsToken[] {
  const tokens: ClsToken[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("$$")) continue;
    // Split on first "/" to separate type from args
    const slashIdx = line.indexOf("/");
    if (slashIdx === -1) {
      // bare keyword: RAPID, END-OF-PATH, etc.
      tokens.push({ type: line.toUpperCase(), args: [], raw: line });
      continue;
    }
    const type = line.slice(0, slashIdx).trim().toUpperCase();
    const rest = line.slice(slashIdx + 1).trim();
    // Args split by comma; preserve negative numbers
    const args = rest.split(",").map(s => s.trim()).filter(Boolean);
    tokens.push({ type, args, raw: line });
  }
  return tokens;
}

// ─── State for conversion ────────────────────────────────────────────
interface ConvState {
  toolNum: string;
  adjustNum: string;
  toolDia: number;
  toolRad: number;
  toolLen: number;
  spindleRpm: number;
  spindleDir: string;
  feedRate: number;
  safeZ: number;
  safeZSet: boolean;
  // Canned cycle
  cycleActive: boolean;
  cycleStep: number;
  cycleClear: number;
  cycleFedTo: number;
  cycleFeed: number;
  cycleRtrcto: string;
  // After G80 flag
  needRapid: boolean;
  safeZUsedAfterG80: boolean;
  // Tool change done (G43 issued)
  g43Done: boolean;
  // Current operation name
  opName: string;
  opCount: number;
}

function fmt(v: number): string {
  // Remove trailing zeros after decimal, but keep at least one if needed
  const s = v.toFixed(4).replace(/\.?0+$/, "");
  return s.includes(".") ? s : s + ".";
}

// ─── Fanuc Converter ─────────────────────────────────────────────────
function convertFanuc(tokens: ClsToken[], programName: string): string {
  const lines: string[] = [];
  const progNum = programName.replace(/\D/g, "").padStart(3, "0").slice(0, 4) || "001";
  const progLabel = programName.replace(/_/g, " ").toUpperCase();

  lines.push("%");
  lines.push(`O${progNum} (${progLabel})`);
  lines.push("(FANUC 3 EKSEN)");
  lines.push("G21");
  lines.push("G00 G49 G17 G80 G40 G90");
  lines.push("G91 G28 Z0.");
  lines.push("G90");

  const st: ConvState = {
    toolNum: "1", adjustNum: "1",
    toolDia: 0, toolRad: 0, toolLen: 0,
    spindleRpm: 0, spindleDir: "M3",
    feedRate: 0,
    safeZ: 0, safeZSet: false,
    cycleActive: false,
    cycleStep: 0, cycleClear: 2, cycleFedTo: 0, cycleFeed: 250, cycleRtrcto: "AUTO",
    needRapid: false, safeZUsedAfterG80: false,
    g43Done: false,
    opName: "", opCount: 0,
  };

  for (const tok of tokens) {
    switch (tok.type) {

      case "TOOL PATH": {
        // TOOL PATH/opname,TOOL,Dxx-toolname
        const opName = tok.args[0] ?? "";
        st.opName = opName;
        st.opCount++;
        st.g43Done = false;
        st.cycleActive = false;
        st.needRapid = false;
        st.safeZUsedAfterG80 = false;
        lines.push(`( Operation Start ${opName} )`);
        break;
      }

      case "TLDATA": {
        // TLDATA/MILL,dia,radius,length,...
        if (tok.args[0]?.toUpperCase() === "MILL") {
          st.toolDia = parseFloat(tok.args[1] ?? "0");
          st.toolRad = parseFloat(tok.args[2] ?? "0");
          st.toolLen = parseFloat(tok.args[3] ?? "0");
        }
        break;
      }

      case "LOAD": {
        // LOAD/TOOL,62,ADJUST,62
        if (tok.args[0]?.toUpperCase() === "TOOL") {
          st.toolNum = tok.args[1] ?? "1";
          // Find ADJUST index
          const adjIdx = tok.args.findIndex(a => a.toUpperCase() === "ADJUST");
          if (adjIdx !== -1) st.adjustNum = tok.args[adjIdx + 1] ?? st.toolNum;
          // Emit tool info comment & tool change
          lines.push(`( Takim No: T${st.toolNum}, Takim Capi: ${st.toolDia}., Takim Radyusu :${st.toolRad}., Takim Boyu: ${st.toolLen}. )`);
          lines.push(`T${st.toolNum} M6`);
          lines.push(`T${st.toolNum}`);
          lines.push("G00 G90 G54");
        }
        break;
      }

      case "SELECT": {
        // SELECT/TOOL,62 — already handled by LOAD, skip
        break;
      }

      case "SPINDL": {
        // SPINDL/RPM,3600,CLW  or  SPINDL/3600,RPM,CLW
        // Find RPM value — it's the first numeric arg
        const rpmIdx = tok.args.findIndex(a => a.toUpperCase() === "RPM");
        if (rpmIdx !== -1) {
          st.spindleRpm = parseFloat(tok.args[rpmIdx - 1] ?? tok.args[rpmIdx + 1] ?? "1000");
        } else {
          st.spindleRpm = parseFloat(tok.args[0] ?? "1000");
        }
        const hasCCLW = tok.args.some(a => a.toUpperCase() === "CCLW");
        st.spindleDir = hasCCLW ? "M4" : "M3";
        lines.push(`S${st.spindleRpm} ${st.spindleDir}`);
        lines.push("M08");
        break;
      }

      case "RAPID": {
        // Just a mode switch — next GOTO will be rapid
        break;
      }

      case "GOTO": {
        const x = parseFloat(tok.args[0] ?? "0");
        const y = parseFloat(tok.args[1] ?? "0");
        const z = parseFloat(tok.args[2] ?? "0");
        const hasNormal = tok.args.length >= 6;

        if (hasNormal) {
          // First positioning move with tool axis normal — sets safe Z
          st.safeZ = z;
          st.safeZSet = true;
          if (!st.g43Done) {
            lines.push(`G00 X${fmt(x)} Y${fmt(y)}`);
            lines.push(`G43 Z${fmt(z)} H${st.adjustNum}`);
            lines.push("G00");
            st.g43Done = true;
          } else {
            lines.push(`G00 X${fmt(x)} Y${fmt(y)} Z${fmt(z)}`);
          }
          st.needRapid = false;
        } else if (st.cycleActive) {
          // Inside canned cycle — emit G83 or G00+G83
          const r = z + st.cycleClear;
          const depth = z + st.cycleFedTo;
          const cycLine = `G98 G83 X${fmt(x)} Y${fmt(y)} R${fmt(r)} Z${fmt(depth)} Q${fmt(st.cycleStep)} F${st.cycleFeed}.`;

          if (st.needRapid) {
            // Need to rapid to this position after a G80
            if (!st.safeZUsedAfterG80 && st.safeZSet) {
              lines.push(`G00 X${fmt(x)} Y${fmt(y)} Z${fmt(st.safeZ)}`);
              st.safeZUsedAfterG80 = true;
            } else {
              lines.push(`G00 X${fmt(x)} Y${fmt(y)}`);
            }
            st.needRapid = false;
          }
          lines.push(cycLine);
        } else {
          // Normal move
          lines.push(`G00 X${fmt(x)} Y${fmt(y)} Z${fmt(z)}`);
        }
        break;
      }

      case "FEDRAT": {
        const feedIdx = tok.args.findIndex(a => a.toUpperCase() === "MMPM" || a.toUpperCase() === "MMPR");
        st.feedRate = parseFloat(
          feedIdx !== -1 ? tok.args[feedIdx - 1] ?? tok.args[0] ?? "250" : tok.args[0] ?? "250"
        );
        break;
      }

      case "CYCLE": {
        const sub = tok.args[0]?.toUpperCase() ?? "";

        if (sub === "DRILL") {
          // CYCLE/DRILL,DEEP,STEP,20,CLEAR,3,FEDTO,-72,RTRCTO,AUTO,MMPM,250
          st.cycleActive = true;
          st.needRapid = false;
          st.safeZUsedAfterG80 = false;
          // Parse keyword-value pairs
          for (let i = 0; i < tok.args.length - 1; i++) {
            const key = tok.args[i]?.toUpperCase();
            const val = tok.args[i + 1];
            if (key === "STEP")   { st.cycleStep  = parseFloat(val); i++; }
            if (key === "CLEAR")  { st.cycleClear = parseFloat(val); i++; }
            if (key === "FEDTO")  { st.cycleFedTo = parseFloat(val); i++; }
            if (key === "MMPM")   { st.cycleFeed  = parseFloat(val); i++; }
            if (key === "RTRCTO") { st.cycleRtrcto = val; i++; }
          }
        } else if (sub === "ON") {
          // CYCLE/ON,FEDTO,-74.5,RTRCTO,AUTO — close previous group, update params
          if (st.cycleActive) {
            lines.push("G80");
            st.needRapid = true;
            st.safeZUsedAfterG80 = false;
          } else {
            st.cycleActive = true;
          }
          for (let i = 0; i < tok.args.length - 1; i++) {
            const key = tok.args[i]?.toUpperCase();
            const val = tok.args[i + 1];
            if (key === "FEDTO")  { st.cycleFedTo = parseFloat(val); i++; }
            if (key === "MMPM")   { st.cycleFeed  = parseFloat(val); i++; }
            if (key === "STEP")   { st.cycleStep  = parseFloat(val); i++; }
            if (key === "CLEAR")  { st.cycleClear = parseFloat(val); i++; }
          }
        } else if (sub === "OFF") {
          lines.push("G80");
          st.cycleActive = false;
          st.needRapid = false;
        }
        break;
      }

      case "COOLNT": {
        const on = tok.args[0]?.toUpperCase() !== "OFF";
        lines.push(on ? "M08" : "M09");
        break;
      }

      case "END-OF-PATH": {
        if (st.cycleActive) {
          lines.push("G80");
          st.cycleActive = false;
        }
        lines.push(`( Operation End ${st.opName} )`);
        break;
      }

      case "PAINT":
      case "MSYS":
        // Ignore visualization/coordinate system directives
        break;

      default: {
        // Unknown tokens as comments
        lines.push(`(${tok.raw})`);
        break;
      }
    }
  }

  // Footer
  lines.push("M05");
  lines.push("M09");
  lines.push("G91 G28 Z0.");
  lines.push("G91 G28 Y0.");
  lines.push("M30");
  lines.push("%");

  return lines.join("\n");
}

// ─── Heidenhain Converter ─────────────────────────────────────────────
// Cycle type enum for Heidenhain
type HeidCycleType = "none" | "drill" | "pocket";

interface HeidCycleParams {
  type: HeidCycleType;
  // CYCL DEF 200 – Drilling
  step: number;      // Q202 infeed depth (peck)
  clear: number;     // Q200 set-up clearance
  fedTo: number;     // absolute Z of drill bottom (from FEDTO)
  feed: number;      // Q206 plunge feed
  dwell: number;     // Q211 dwell at bottom
  // CYCL DEF 251 – Rectangular Pocket
  sideX: number;     // Q218 first side length
  sideY: number;     // Q219 second side length
  wallAllowance: number; // Q368
  rotation: number;  // Q374
  millFeed: number;  // Q207
  finFeed: number;   // Q385
  overlap: number;   // Q370 (0.5 = 50%)
  plungeType: number;// Q366 (0=vertical, 1=helix)
  // defined = CYCL DEF already emitted for this group
  defined: boolean;
  refZ: number;      // surface Z (from first GOTO in cycle)
}

function emitCyclDef200(lines: string[], p: HeidCycleParams, n: () => number, refZ: number, safeZ: number): void {
  const depth = refZ + p.fedTo; // depth below surface (Q201, negative)
  lines.push(`N${n()} CYCL DEF 200 DRILLING ~`);
  lines.push(`  Q200=+${p.clear.toFixed(3)} ;SETUP CLEARANCE`);
  lines.push(`  Q201=${depth.toFixed(3)} ;DEPTH`);
  lines.push(`  Q206=+${p.feed.toFixed(0)} ;FEED RATE FOR PLUNGING`);
  lines.push(`  Q202=+${p.step.toFixed(3)} ;INFEED DEPTH`);
  lines.push(`  Q210=+0 ;DWELL TIME AT TOP`);
  lines.push(`  Q203=+${refZ.toFixed(3)} ;SURFACE COORDINATE`);
  lines.push(`  Q204=+${safeZ.toFixed(3)} ;2ND SETUP CLEARANCE`);
  lines.push(`  Q211=+${p.dwell.toFixed(3)} ;DWELL TIME AT BOTTOM`);
}

function emitCyclDef251(lines: string[], p: HeidCycleParams, n: () => number, refZ: number, safeZ: number): void {
  const depth = p.fedTo; // Q201 total depth (negative)
  lines.push(`N${n()} CYCL DEF 251 RECTANGULAR POCKET ~`);
  lines.push(`  Q218=+${p.sideX.toFixed(3)} ;FIRST SIDE LENGTH`);
  lines.push(`  Q219=+${p.sideY.toFixed(3)} ;SECOND SIDE LENGTH`);
  lines.push(`  Q368=+${p.wallAllowance.toFixed(3)} ;ALLOWANCE FOR SIDE`);
  lines.push(`  Q374=+${p.rotation.toFixed(3)} ;ANGLE OF ROTATION`);
  lines.push(`  Q367=+0 ;POCKET POSITION`);
  lines.push(`  Q207=+${p.millFeed.toFixed(0)} ;FEED RATE FOR MILLING`);
  lines.push(`  Q351=+1 ;CLIMB OR UP-CUT`);
  lines.push(`  Q201=${depth.toFixed(3)} ;DEPTH`);
  lines.push(`  Q202=+${p.step.toFixed(3)} ;PLUNGING DEPTH`);
  lines.push(`  Q206=+${p.feed.toFixed(0)} ;FEED RATE FOR PLUNGING`);
  lines.push(`  Q200=+${p.clear.toFixed(3)} ;SETUP CLEARANCE`);
  lines.push(`  Q203=+${refZ.toFixed(3)} ;SURFACE COORDINATE`);
  lines.push(`  Q204=+${safeZ.toFixed(3)} ;2ND SETUP CLEARANCE`);
  lines.push(`  Q370=+${p.overlap.toFixed(2)} ;TOOL PATH OVERLAP`);
  lines.push(`  Q366=+${p.plungeType} ;PLUNGING`);
  lines.push(`  Q385=+${p.finFeed.toFixed(0)} ;FEED RATE FOR FINISH`);
}

function convertHeidenhain(tokens: ClsToken[], programName: string): string {
  const lines: string[] = [];
  lines.push(`BEGIN PGM ${programName.toUpperCase()} MM`);

  let seq = 0;
  const n = () => { seq += 10; return seq; };

  let toolNum = "1";
  let toolDia = 0, toolLen = 0;
  let spindleRpm = 0;
  let safeZ = 0;
  let opName = "";
  let g43Done = false;

  const cyc: HeidCycleParams = {
    type: "none", step: 5, clear: 2, fedTo: 0, feed: 250, dwell: 0,
    sideX: 50, sideY: 30, wallAllowance: 0, rotation: 0,
    millFeed: 500, finFeed: 500, overlap: 0.5, plungeType: 1,
    defined: false, refZ: 0,
  };

  const parseCycleArgs = (args: string[]) => {
    for (let i = 0; i < args.length - 1; i++) {
      const k = args[i]?.toUpperCase();
      const v = parseFloat(args[i + 1] ?? "0");
      if (k === "STEP")    { cyc.step    = v; i++; }
      if (k === "CLEAR")   { cyc.clear   = v; i++; }
      if (k === "FEDTO")   { cyc.fedTo   = v; i++; }
      if (k === "MMPM")    { cyc.feed    = v; i++; }
      if (k === "DWELL")   { cyc.dwell   = v; i++; }
      if (k === "WIDTH")   { cyc.sideX   = v; i++; }
      if (k === "LENGTH")  { cyc.sideY   = v; i++; }
      if (k === "ALLOWANCE")   { cyc.wallAllowance = v; i++; }
      if (k === "ANGLE")   { cyc.rotation = v; i++; }
      if (k === "MILLFEED"){ cyc.millFeed = v; i++; }
    }
  };

  for (const tok of tokens) {
    switch (tok.type) {

      case "TOOL PATH": {
        opName = tok.args[0] ?? "";
        g43Done = false;
        cyc.type = "none";
        cyc.defined = false;
        lines.push(`; *** Operation: ${opName} ***`);
        break;
      }

      case "TLDATA":
        if (tok.args[0]?.toUpperCase() === "MILL") {
          toolDia = parseFloat(tok.args[1] ?? "0");
          toolLen = parseFloat(tok.args[3] ?? "0");
          lines.push(`; Takim: DIA=${toolDia}mm  LEN=${toolLen}mm`);
        }
        break;

      case "LOAD":
        if (tok.args[0]?.toUpperCase() === "TOOL") {
          toolNum = tok.args[1] ?? "1";
          // Emit TOOL CALL after spindle is known — defer with placeholder if needed
          lines.push(`N${n()} TOOL CALL ${toolNum} Z S${spindleRpm || 3000}`);
          lines.push(`N${n()} L Z+${safeZ || 100} FMAX`);
        }
        break;

      case "SPINDL": {
        const ri = tok.args.findIndex(a => a.toUpperCase() === "RPM");
        spindleRpm = parseFloat(
          ri !== -1 ? (tok.args[ri - 1] ?? tok.args[ri + 1] ?? "3000") : (tok.args[0] ?? "3000")
        );
        const ccw = tok.args.some(a => a.toUpperCase() === "CCLW");
        lines.push(`N${n()} S${spindleRpm} ${ccw ? "M4" : "M3"}`);
        break;
      }

      case "RAPID":
        // Mode switch — no output needed in Heidenhain (FMAX handles it)
        break;

      case "GOTO": {
        const x = parseFloat(tok.args[0] ?? "0");
        const y = parseFloat(tok.args[1] ?? "0");
        const z = parseFloat(tok.args[2] ?? "0");

        if (tok.args.length >= 6) {
          // First positioning move with tool axis — safe Z
          safeZ = z;
          if (!g43Done) {
            lines.push(`N${n()} L X+${x.toFixed(3)} Y+${y.toFixed(3)} R0 FMAX`);
            lines.push(`N${n()} L Z+${z.toFixed(3)} FMAX`);
            g43Done = true;
          } else {
            lines.push(`N${n()} L X+${x.toFixed(3)} Y+${y.toFixed(3)} Z+${z.toFixed(3)} R0 FMAX`);
          }
        } else if (cyc.type !== "none") {
          // First GOTO in cycle group — emit CYCL DEF here (we now know refZ)
          if (!cyc.defined) {
            cyc.refZ = z;
            if (cyc.type === "drill") {
              emitCyclDef200(lines, cyc, n, z, safeZ);
            } else if (cyc.type === "pocket") {
              emitCyclDef251(lines, cyc, n, z, safeZ);
            }
            cyc.defined = true;
          }
          // Hole/pocket call
          lines.push(`N${n()} L X+${x.toFixed(3)} Y+${y.toFixed(3)} R0 FMAX M99`);
        } else {
          lines.push(`N${n()} L X+${x.toFixed(3)} Y+${y.toFixed(3)} Z+${z.toFixed(3)} R0 FMAX`);
        }
        break;
      }

      case "CYCLE": {
        const sub = tok.args[0]?.toUpperCase() ?? "";

        if (sub === "DRILL") {
          cyc.type = "drill";
          cyc.defined = false;
          parseCycleArgs(tok.args);
        } else if (sub === "MILL") {
          // CYCLE/MILL → CYCL DEF 251 Rectangular Pocket
          cyc.type = "pocket";
          cyc.defined = false;
          parseCycleArgs(tok.args);
        } else if (sub === "ON") {
          // Parameter update — re-emit CYCL DEF on next GOTO
          cyc.defined = false;
          parseCycleArgs(tok.args);
        } else if (sub === "OFF") {
          cyc.type = "none";
          cyc.defined = false;
          lines.push(`; CYCLE OFF`);
        }
        break;
      }

      case "COOLNT":
        lines.push(`N${n()} ${tok.args[0]?.toUpperCase() !== "OFF" ? "M08" : "M09"}`);
        break;

      case "END-OF-PATH":
        if (cyc.type !== "none") {
          cyc.type = "none";
          cyc.defined = false;
        }
        lines.push(`N${n()} L Z+${safeZ} FMAX`);
        lines.push(`; *** End: ${opName} ***`);
        break;

      case "PAINT": case "MSYS": case "SELECT":
        break;

      default:
        lines.push(`; ${tok.raw}`);
    }
  }

  lines.push(`N${n()} M05`);
  lines.push(`N${n()} M09`);
  lines.push(`N${n()} M30`);
  lines.push(`END PGM ${programName.toUpperCase()} MM`);
  return lines.join("\n");
}

// ─── Sample CLS for Heidenhain pocket demo ────────────────────────────
export const SAMPLE_CLS_POCKET = `TOOL PATH/O2-D20-PARMAK-FREZE,TOOL,D20.00-ENDMILL
TLDATA/MILL,20.0000,0.0000,80.0000,0.0000,0.0000
LOAD/TOOL,5,ADJUST,5
SPINDL/RPM,4000,CLW
RAPID
GOTO/0.0000,0.0000,100.0000,0.0000000,0.0000000,1.0000000
CYCLE/MILL,FEDTO,-15.0000,STEP,5.0000,CLEAR,3.0000,MMPM,800.0000,WIDTH,60.0000,LENGTH,40.0000
GOTO/50.0000,25.0000,0.0000
CYCLE/OFF
END-OF-PATH`;


// ─── Siemens Converter ────────────────────────────────────────────────
function convertSiemens(tokens: ClsToken[], programName: string): string {
  const lines: string[] = [];
  lines.push(`; ${programName.toUpperCase()}.MPF`);
  lines.push("; Generated by GAGE Post Processor");
  lines.push("G17 G90 G94 G71");

  let toolNum = "1";
  let spindleRpm = 0;
  let feedRate = 0;
  let cycleActive = false;
  let cycleStep = 0, cycleClear = 2, cycleFedTo = 0, cycleFeed = 250;
  let opName = "";
  let safeZ = 0;

  for (const tok of tokens) {
    switch (tok.type) {
      case "TOOL PATH":
        opName = tok.args[0] ?? "";
        lines.push(`; *** ${opName} ***`);
        break;
      case "TLDATA":
        if (tok.args[0]?.toUpperCase() === "MILL") {
          lines.push(`; T DIA=${tok.args[1]} LEN=${tok.args[3]}`);
        }
        break;
      case "LOAD":
        if (tok.args[0]?.toUpperCase() === "TOOL") {
          toolNum = tok.args[1] ?? "1";
          lines.push(`T${toolNum} D1`);
          lines.push("M06");
          lines.push("G00 G90");
        }
        break;
      case "SPINDL": {
        const ri = tok.args.findIndex(a => a.toUpperCase() === "RPM");
        spindleRpm = parseFloat(ri !== -1 ? (tok.args[ri-1] ?? tok.args[ri+1] ?? "3000") : (tok.args[0] ?? "3000"));
        const ccw = tok.args.some(a => a.toUpperCase() === "CCLW");
        lines.push(`S${spindleRpm} ${ccw ? "M4" : "M3"}`);
        lines.push("M08");
        break;
      }
      case "GOTO": {
        const x = parseFloat(tok.args[0] ?? "0");
        const y = parseFloat(tok.args[1] ?? "0");
        const z = parseFloat(tok.args[2] ?? "0");
        if (tok.args.length >= 6) {
          safeZ = z;
          lines.push(`G00 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)}`);
        } else if (cycleActive) {
          const depth = z + cycleFedTo;
          const r = z + cycleClear;
          lines.push(`MCALL CYCLE83(${r.toFixed(3)},${z.toFixed(3)},${cycleClear.toFixed(3)},${depth.toFixed(3)},,${cycleStep.toFixed(3)},${cycleFeed}.,,,1,1,1)`);
          lines.push(`HOLES1(${x.toFixed(3)},${y.toFixed(3)},0,0,1,0)`);
          lines.push("MCALL");
        } else {
          lines.push(`G00 X${x.toFixed(3)} Y${y.toFixed(3)} Z${z.toFixed(3)}`);
        }
        break;
      }
      case "CYCLE": {
        const sub = tok.args[0]?.toUpperCase() ?? "";
        if (sub === "DRILL" || sub === "ON") {
          cycleActive = true;
          for (let i = 0; i < tok.args.length - 1; i++) {
            const k = tok.args[i]?.toUpperCase();
            if (k === "STEP")  { cycleStep  = parseFloat(tok.args[i+1]); i++; }
            if (k === "CLEAR") { cycleClear = parseFloat(tok.args[i+1]); i++; }
            if (k === "FEDTO") { cycleFedTo = parseFloat(tok.args[i+1]); i++; }
            if (k === "MMPM")  { cycleFeed  = parseFloat(tok.args[i+1]); i++; }
          }
        } else if (sub === "OFF") {
          cycleActive = false;
        }
        break;
      }
      case "COOLNT":
        lines.push(tok.args[0]?.toUpperCase() !== "OFF" ? "M08" : "M09");
        break;
      case "END-OF-PATH":
        lines.push(`; *** End ${opName} ***`);
        break;
      case "PAINT": case "MSYS": case "SELECT": break;
      default:
        lines.push(`; ${tok.raw}`);
    }
  }

  lines.push("M05");
  lines.push("M09");
  lines.push("M30");
  return lines.join("\n");
}

// ─── Okuma / Mazak share Fanuc base ─────────────────────────────────
function convertOkuma(tokens: ClsToken[], programName: string): string {
  return convertFanuc(tokens, programName)
    .replace(/^O\d+/, `O${programName.replace(/\D/g,"").padStart(4,"1").slice(0,4)}`)
    .replace("(FANUC 3 EKSEN)", "(OKUMA OSP-P300)");
}
function convertMazak(tokens: ClsToken[], programName: string): string {
  return convertFanuc(tokens, programName)
    .replace("(FANUC 3 EKSEN)", "(MAZAK ISO G-CODE)");
}

// ─── Master dispatcher ───────────────────────────────────────────────
function convertCLS(tokens: ClsToken[], ctrl: ControllerType, programName: string): string {
  switch (ctrl) {
    case "fanuc":      return convertFanuc(tokens, programName);
    case "heidenhain": return convertHeidenhain(tokens, programName);
    case "siemens":    return convertSiemens(tokens, programName);
    case "okuma":      return convertOkuma(tokens, programName);
    case "mazak":      return convertMazak(tokens, programName);
  }
}

// ─── Sample CLS ──────────────────────────────────────────────────────
const SAMPLE_CLS = `TOOL PATH/O1-D13-MATKAP-1,TOOL,D13.00-MATKAP
TLDATA/MILL,13.0000,0.0000,75.0000,0.0000,0.0000
MSYS/0.0000,0.0000,-50.0000,1.0000000,0.0000000,0.0000000,0.0000000,1.0000000,0.0000000
$$ centerline data
PAINT/PATH
PAINT/SPEED,10
LOAD/TOOL,62,ADJUST,62
SELECT/TOOL,62
SPINDL/RPM,3600,CLW
PAINT/COLOR,186
RAPID
GOTO/67.5000,145.9000,80.0000,0.0000000,0.0000000,1.0000000
CYCLE/DRILL,DEEP,STEP,20.0000,CLEAR,3.0000,FEDTO,-72.0000,RTRCTO,AUTO,MMPM,250.0000
PAINT/COLOR,31
GOTO/67.5000,145.9000,70.0000
GOTO/-21.3440,136.1000,70.0000
GOTO/-107.5000,147.9000,70.0000
GOTO/-207.5000,129.9000,70.0000
CYCLE/ON,FEDTO,-74.5000,RTRCTO,AUTO
GOTO/-191.4097,47.4583,70.0000
CYCLE/ON,FEDTO,-72.0000,RTRCTO,AUTO
GOTO/-207.5000,-36.1000,70.0000
GOTO/-145.7000,-104.6000,70.0000
CYCLE/OFF
END-OF-PATH`;

// ─── Samples ─────────────────────────────────────────────────────────
const SAMPLES: { label: string; ctrl: ControllerType; cls: string }[] = [
  {
    label: "Fanuc – Delme (G83)",
    ctrl: "fanuc",
    cls: SAMPLE_CLS,
  },
  {
    label: "Heidenhain – Delme (CYCL DEF 200)",
    ctrl: "heidenhain",
    cls: `TOOL PATH/O1-D13-MATKAP,TOOL,D13.00-MATKAP
TLDATA/MILL,13.0000,0.0000,75.0000,0.0000,0.0000
LOAD/TOOL,62,ADJUST,62
SPINDL/RPM,3600,CLW
RAPID
GOTO/0.0000,0.0000,80.0000,0.0000000,0.0000000,1.0000000
CYCLE/DRILL,DEEP,STEP,20.0000,CLEAR,3.0000,FEDTO,-72.0000,RTRCTO,AUTO,MMPM,250.0000
GOTO/67.5000,145.9000,70.0000
GOTO/-21.3440,136.1000,70.0000
GOTO/-107.5000,147.9000,70.0000
GOTO/-207.5000,129.9000,70.0000
CYCLE/ON,FEDTO,-74.5000,RTRCTO,AUTO
GOTO/-191.4097,47.4583,70.0000
CYCLE/ON,FEDTO,-72.0000,RTRCTO,AUTO
GOTO/-207.5000,-36.1000,70.0000
GOTO/-145.7000,-104.6000,70.0000
CYCLE/OFF
END-OF-PATH`,
  },
  {
    label: "Heidenhain – Dikdörtgen Cep (CYCL DEF 251)",
    ctrl: "heidenhain",
    cls: `TOOL PATH/O2-D20-PARMAK-FREZE,TOOL,D20.00-ENDMILL
TLDATA/MILL,20.0000,0.0000,80.0000,0.0000,0.0000
LOAD/TOOL,5,ADJUST,5
SPINDL/RPM,4000,CLW
RAPID
GOTO/0.0000,0.0000,100.0000,0.0000000,0.0000000,1.0000000
CYCLE/MILL,FEDTO,-15.0000,STEP,5.0000,CLEAR,3.0000,MMPM,800.0000,WIDTH,60.0000,LENGTH,40.0000
GOTO/50.0000,25.0000,0.0000
CYCLE/OFF
END-OF-PATH`,
  },
];

// ─── Component ───────────────────────────────────────────────────────
const PostProcessor = () => {
  const { t } = useLanguage();
  const { machines } = useMachines();

  const [clsInput, setClsInput] = useState(SAMPLE_CLS);
  const [controller, setController] = useState<ControllerType>("fanuc");
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [programName, setProgramName] = useState("DELIKLER");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [converted, setConverted] = useState(false);

  const selectedCtrl = CONTROLLERS.find(c => c.id === controller)!;

  const handleConvert = useCallback(() => {
    setError("");
    try {
      const tokens = parseCLS(clsInput);
      if (!tokens.length) throw new Error("CLS verisi boş veya okunamadı.");
      const result = convertCLS(tokens, controller, programName);
      setOutput(result);
      setConverted(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [clsInput, controller, programName]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setClsInput(ev.target?.result as string);
      setConverted(false);
      setOutput("");
      setProgramName(file.name.replace(/\.[^.]+$/, "").toUpperCase().replace(/\s+/g, "_").slice(0, 16));
    };
    reader.readAsText(file);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (ext?: string) => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${programName}.${ext ?? selectedCtrl.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="industrial-card p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">CLS Post Processor</h2>
            <p className="text-xs text-muted-foreground">NX / APT CLS → Makine G-Kodu</p>
          </div>
        </div>
        {converted && (
          <div className="flex gap-2">
            <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-sm">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
            <button onClick={() => handleDownload()} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors text-sm">
              <Download className="w-4 h-4" />
              .{selectedCtrl.ext}
            </button>
            <button onClick={() => handleDownload("tap")} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all text-sm">
              <Download className="w-4 h-4" />
              .TAP
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LEFT — Settings + CLS Input */}
        <div className="space-y-4">

          {/* Controller selection */}
          <div>
            <label className="label-industrial block mb-2">CNC Kontrolcü</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONTROLLERS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setController(c.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    controller === c.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                  }`}
                >
                  <span className="font-medium block">{c.label}</span>
                  <span className="text-xs opacity-70">{c.dialect} · .{c.ext}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Machine select */}
          {machines.length > 0 && (
            <div>
              <label className="label-industrial block mb-2">Tezgah (opsiyonel)</label>
              <select
                value={selectedMachineId}
                onChange={e => setSelectedMachineId(e.target.value)}
                className="input-industrial w-full"
              >
                <option value="">— Seçiniz —</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>{m.label} ({m.brand} {m.model})</option>
                ))}
              </select>
            </div>
          )}

          {/* Program name */}
          <div>
            <label className="label-industrial block mb-2">Program Adı</label>
            <input
              type="text"
              value={programName}
              onChange={e => setProgramName(e.target.value.toUpperCase().replace(/\s+/g, "_").slice(0, 20))}
              className="input-industrial w-full font-mono"
              maxLength={20}
              placeholder="DELIKLER"
            />
          </div>

          {/* CLS Input */}
          {/* Quick sample loader */}
          <div>
            <label className="label-industrial block mb-2">Örnek Yükle</label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setClsInput(s.cls);
                    setController(s.ctrl);
                    setConverted(false);
                    setOutput("");
                    setProgramName(s.label.split("–")[1]?.trim().split(" ")[0] ?? "SAMPLE");
                  }}
                  className="px-2.5 py-1 rounded-md border border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-xs text-muted-foreground transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-industrial">CLS / APT Girişi</label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-primary hover:text-primary/80 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Dosya Yükle (.cls / .apt)
                <input type="file" accept=".cls,.apt,.clt,.ncf,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              value={clsInput}
              onChange={e => { setClsInput(e.target.value); setConverted(false); setOutput(""); }}
              className="input-industrial w-full font-mono text-xs resize-none"
              rows={18}
              placeholder="CLS verisini buraya yapıştırın..."
              spellCheck={false}
            />
          </div>

          {/* Convert button */}
          <button
            onClick={handleConvert}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <FileCode className="w-4 h-4" />
            Çevir → {selectedCtrl.label}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* RIGHT — G-Code Output */}
        <div className="flex flex-col">
          <div className="bg-card rounded-lg border border-border overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-secondary/30 border-b border-border">
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">
                  {programName}.{selectedCtrl.ext}
                </span>
              </div>
              <span className={`text-xs font-mono ${converted ? "text-success" : "text-muted-foreground"}`}>
                {converted ? `● ${selectedCtrl.dialect}` : "● Bekleniyor"}
              </span>
            </div>
            <pre className="p-4 text-xs font-mono text-success overflow-auto flex-1 whitespace-pre min-h-[400px]">
              {output || (
                <span className="text-muted-foreground">
                  {`// Çıktı burada görünecek\n// Soldaki panelden CLS verinizi\n// girin ve "Çevir" butonuna tıklayın.`}
                </span>
              )}
            </pre>
          </div>

          {/* Stats */}
          {converted && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="p-2 rounded-lg bg-card border border-border text-center">
                <div className="text-lg font-mono text-primary">{output.split("\n").length}</div>
                <div className="text-xs text-muted-foreground">Satır</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border text-center">
                <div className="text-lg font-mono text-accent">{parseCLS(clsInput).length}</div>
                <div className="text-xs text-muted-foreground">CLS Token</div>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border text-center">
                <div className="text-lg font-mono text-success">{Math.round(output.length / 1024 * 10) / 10}K</div>
                <div className="text-xs text-muted-foreground">Boyut</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostProcessor;
