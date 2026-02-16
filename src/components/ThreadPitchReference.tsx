import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, BookOpen } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

/* ═══════════════════════════════════════════════
   COMPREHENSIVE THREAD PITCH REFERENCE DATA
   ═══════════════════════════════════════════════ */

interface ThreadPitchRow {
  designation: string;
  nominal: number;       // mm
  pitch: number;         // mm
  pilotDrill: number;    // mm
  minorDia: number;      // mm
  pitchDia: number;      // mm
  threadDepth: number;   // mm (H = 0.6134 × P)
}

// ── Metrik Kaba Diş (ISO 261 / DIN 13) ──
const metricCoarsePitches: ThreadPitchRow[] = [
  { designation: "M1", nominal: 1, pitch: 0.25, pilotDrill: 0.75, minorDia: 0.729, pitchDia: 0.838, threadDepth: 0.153 },
  { designation: "M1.2", nominal: 1.2, pitch: 0.25, pilotDrill: 0.95, minorDia: 0.929, pitchDia: 1.038, threadDepth: 0.153 },
  { designation: "M1.4", nominal: 1.4, pitch: 0.3, pilotDrill: 1.1, minorDia: 1.075, pitchDia: 1.205, threadDepth: 0.184 },
  { designation: "M1.6", nominal: 1.6, pitch: 0.35, pilotDrill: 1.25, minorDia: 1.221, pitchDia: 1.373, threadDepth: 0.215 },
  { designation: "M1.8", nominal: 1.8, pitch: 0.35, pilotDrill: 1.45, minorDia: 1.421, pitchDia: 1.573, threadDepth: 0.215 },
  { designation: "M2", nominal: 2, pitch: 0.4, pilotDrill: 1.6, minorDia: 1.567, pitchDia: 1.740, threadDepth: 0.245 },
  { designation: "M2.5", nominal: 2.5, pitch: 0.45, pilotDrill: 2.05, minorDia: 2.013, pitchDia: 2.208, threadDepth: 0.276 },
  { designation: "M3", nominal: 3, pitch: 0.5, pilotDrill: 2.5, minorDia: 2.459, pitchDia: 2.675, threadDepth: 0.307 },
  { designation: "M3.5", nominal: 3.5, pitch: 0.6, pilotDrill: 2.9, minorDia: 2.850, pitchDia: 3.110, threadDepth: 0.368 },
  { designation: "M4", nominal: 4, pitch: 0.7, pilotDrill: 3.3, minorDia: 3.242, pitchDia: 3.545, threadDepth: 0.429 },
  { designation: "M5", nominal: 5, pitch: 0.8, pilotDrill: 4.2, minorDia: 4.134, pitchDia: 4.480, threadDepth: 0.491 },
  { designation: "M6", nominal: 6, pitch: 1.0, pilotDrill: 5.0, minorDia: 4.917, pitchDia: 5.350, threadDepth: 0.613 },
  { designation: "M7", nominal: 7, pitch: 1.0, pilotDrill: 6.0, minorDia: 5.917, pitchDia: 6.350, threadDepth: 0.613 },
  { designation: "M8", nominal: 8, pitch: 1.25, pilotDrill: 6.8, minorDia: 6.647, pitchDia: 7.188, threadDepth: 0.767 },
  { designation: "M10", nominal: 10, pitch: 1.5, pilotDrill: 8.5, minorDia: 8.376, pitchDia: 9.026, threadDepth: 0.920 },
  { designation: "M12", nominal: 12, pitch: 1.75, pilotDrill: 10.2, minorDia: 10.106, pitchDia: 10.863, threadDepth: 1.074 },
  { designation: "M14", nominal: 14, pitch: 2.0, pilotDrill: 12.0, minorDia: 11.835, pitchDia: 12.701, threadDepth: 1.227 },
  { designation: "M16", nominal: 16, pitch: 2.0, pilotDrill: 14.0, minorDia: 13.835, pitchDia: 14.701, threadDepth: 1.227 },
  { designation: "M18", nominal: 18, pitch: 2.5, pilotDrill: 15.5, minorDia: 15.294, pitchDia: 16.376, threadDepth: 1.534 },
  { designation: "M20", nominal: 20, pitch: 2.5, pilotDrill: 17.5, minorDia: 17.294, pitchDia: 18.376, threadDepth: 1.534 },
  { designation: "M22", nominal: 22, pitch: 2.5, pilotDrill: 19.5, minorDia: 19.294, pitchDia: 20.376, threadDepth: 1.534 },
  { designation: "M24", nominal: 24, pitch: 3.0, pilotDrill: 21.0, minorDia: 20.752, pitchDia: 22.051, threadDepth: 1.840 },
  { designation: "M27", nominal: 27, pitch: 3.0, pilotDrill: 24.0, minorDia: 23.752, pitchDia: 25.051, threadDepth: 1.840 },
  { designation: "M30", nominal: 30, pitch: 3.5, pilotDrill: 26.5, minorDia: 26.211, pitchDia: 27.727, threadDepth: 2.147 },
  { designation: "M33", nominal: 33, pitch: 3.5, pilotDrill: 29.5, minorDia: 29.211, pitchDia: 30.727, threadDepth: 2.147 },
  { designation: "M36", nominal: 36, pitch: 4.0, pilotDrill: 32.0, minorDia: 31.670, pitchDia: 33.402, threadDepth: 2.454 },
  { designation: "M39", nominal: 39, pitch: 4.0, pilotDrill: 35.0, minorDia: 34.670, pitchDia: 36.402, threadDepth: 2.454 },
  { designation: "M42", nominal: 42, pitch: 4.5, pilotDrill: 37.5, minorDia: 37.129, pitchDia: 39.077, threadDepth: 2.760 },
  { designation: "M45", nominal: 45, pitch: 4.5, pilotDrill: 40.5, minorDia: 40.129, pitchDia: 42.077, threadDepth: 2.760 },
  { designation: "M48", nominal: 48, pitch: 5.0, pilotDrill: 43.0, minorDia: 42.587, pitchDia: 44.752, threadDepth: 3.067 },
  { designation: "M52", nominal: 52, pitch: 5.0, pilotDrill: 47.0, minorDia: 46.587, pitchDia: 48.752, threadDepth: 3.067 },
  { designation: "M56", nominal: 56, pitch: 5.5, pilotDrill: 50.5, minorDia: 50.046, pitchDia: 52.428, threadDepth: 3.374 },
  { designation: "M60", nominal: 60, pitch: 5.5, pilotDrill: 54.5, minorDia: 54.046, pitchDia: 56.428, threadDepth: 3.374 },
  { designation: "M64", nominal: 64, pitch: 6.0, pilotDrill: 58.0, minorDia: 57.505, pitchDia: 60.103, threadDepth: 3.681 },
];

// ── Metrik İnce Diş (ISO 261 / DIN 13) ──
const metricFinePitches: ThreadPitchRow[] = [
  { designation: "M3×0.35", nominal: 3, pitch: 0.35, pilotDrill: 2.65, minorDia: 2.621, pitchDia: 2.773, threadDepth: 0.215 },
  { designation: "M4×0.5", nominal: 4, pitch: 0.5, pilotDrill: 3.5, minorDia: 3.459, pitchDia: 3.675, threadDepth: 0.307 },
  { designation: "M5×0.5", nominal: 5, pitch: 0.5, pilotDrill: 4.5, minorDia: 4.459, pitchDia: 4.675, threadDepth: 0.307 },
  { designation: "M6×0.75", nominal: 6, pitch: 0.75, pilotDrill: 5.2, minorDia: 5.188, pitchDia: 5.513, threadDepth: 0.460 },
  { designation: "M8×0.75", nominal: 8, pitch: 0.75, pilotDrill: 7.2, minorDia: 7.188, pitchDia: 7.513, threadDepth: 0.460 },
  { designation: "M8×1", nominal: 8, pitch: 1.0, pilotDrill: 7.0, minorDia: 6.917, pitchDia: 7.350, threadDepth: 0.613 },
  { designation: "M10×0.75", nominal: 10, pitch: 0.75, pilotDrill: 9.2, minorDia: 9.188, pitchDia: 9.513, threadDepth: 0.460 },
  { designation: "M10×1", nominal: 10, pitch: 1.0, pilotDrill: 9.0, minorDia: 8.917, pitchDia: 9.350, threadDepth: 0.613 },
  { designation: "M10×1.25", nominal: 10, pitch: 1.25, pilotDrill: 8.8, minorDia: 8.647, pitchDia: 9.188, threadDepth: 0.767 },
  { designation: "M12×1", nominal: 12, pitch: 1.0, pilotDrill: 11.0, minorDia: 10.917, pitchDia: 11.350, threadDepth: 0.613 },
  { designation: "M12×1.25", nominal: 12, pitch: 1.25, pilotDrill: 10.8, minorDia: 10.647, pitchDia: 11.188, threadDepth: 0.767 },
  { designation: "M12×1.5", nominal: 12, pitch: 1.5, pilotDrill: 10.5, minorDia: 10.376, pitchDia: 11.026, threadDepth: 0.920 },
  { designation: "M14×1", nominal: 14, pitch: 1.0, pilotDrill: 13.0, minorDia: 12.917, pitchDia: 13.350, threadDepth: 0.613 },
  { designation: "M14×1.5", nominal: 14, pitch: 1.5, pilotDrill: 12.5, minorDia: 12.376, pitchDia: 13.026, threadDepth: 0.920 },
  { designation: "M16×1", nominal: 16, pitch: 1.0, pilotDrill: 15.0, minorDia: 14.917, pitchDia: 15.350, threadDepth: 0.613 },
  { designation: "M16×1.5", nominal: 16, pitch: 1.5, pilotDrill: 14.5, minorDia: 14.376, pitchDia: 15.026, threadDepth: 0.920 },
  { designation: "M18×1", nominal: 18, pitch: 1.0, pilotDrill: 17.0, minorDia: 16.917, pitchDia: 17.350, threadDepth: 0.613 },
  { designation: "M18×1.5", nominal: 18, pitch: 1.5, pilotDrill: 16.5, minorDia: 16.376, pitchDia: 17.026, threadDepth: 0.920 },
  { designation: "M18×2", nominal: 18, pitch: 2.0, pilotDrill: 16.0, minorDia: 15.835, pitchDia: 16.701, threadDepth: 1.227 },
  { designation: "M20×1", nominal: 20, pitch: 1.0, pilotDrill: 19.0, minorDia: 18.917, pitchDia: 19.350, threadDepth: 0.613 },
  { designation: "M20×1.5", nominal: 20, pitch: 1.5, pilotDrill: 18.5, minorDia: 18.376, pitchDia: 19.026, threadDepth: 0.920 },
  { designation: "M20×2", nominal: 20, pitch: 2.0, pilotDrill: 18.0, minorDia: 17.835, pitchDia: 18.701, threadDepth: 1.227 },
  { designation: "M24×1.5", nominal: 24, pitch: 1.5, pilotDrill: 22.5, minorDia: 22.376, pitchDia: 23.026, threadDepth: 0.920 },
  { designation: "M24×2", nominal: 24, pitch: 2.0, pilotDrill: 22.0, minorDia: 21.835, pitchDia: 22.701, threadDepth: 1.227 },
  { designation: "M27×1.5", nominal: 27, pitch: 1.5, pilotDrill: 25.5, minorDia: 25.376, pitchDia: 26.026, threadDepth: 0.920 },
  { designation: "M27×2", nominal: 27, pitch: 2.0, pilotDrill: 25.0, minorDia: 24.835, pitchDia: 25.701, threadDepth: 1.227 },
  { designation: "M30×1.5", nominal: 30, pitch: 1.5, pilotDrill: 28.5, minorDia: 28.376, pitchDia: 29.026, threadDepth: 0.920 },
  { designation: "M30×2", nominal: 30, pitch: 2.0, pilotDrill: 28.0, minorDia: 27.835, pitchDia: 28.701, threadDepth: 1.227 },
  { designation: "M33×2", nominal: 33, pitch: 2.0, pilotDrill: 31.0, minorDia: 30.835, pitchDia: 31.701, threadDepth: 1.227 },
  { designation: "M36×1.5", nominal: 36, pitch: 1.5, pilotDrill: 34.5, minorDia: 34.376, pitchDia: 35.026, threadDepth: 0.920 },
  { designation: "M36×2", nominal: 36, pitch: 2.0, pilotDrill: 34.0, minorDia: 33.835, pitchDia: 34.701, threadDepth: 1.227 },
  { designation: "M36×3", nominal: 36, pitch: 3.0, pilotDrill: 33.0, minorDia: 32.752, pitchDia: 34.051, threadDepth: 1.840 },
];

// ── UNC (Unified National Coarse) ──
interface UNCRow {
  designation: string;
  nominal_inch: string;
  nominal_mm: number;
  tpi: number;
  pitch_mm: number;
  pilotDrill_inch: string;
  pilotDrill_mm: number;
  minorDia_mm: number;
}

const uncPitches: UNCRow[] = [
  { designation: "#1-64", nominal_inch: "0.073\"", nominal_mm: 1.854, tpi: 64, pitch_mm: 0.397, pilotDrill_inch: "No.53", pilotDrill_mm: 1.50, minorDia_mm: 1.425 },
  { designation: "#2-56", nominal_inch: "0.086\"", nominal_mm: 2.184, tpi: 56, pitch_mm: 0.454, pilotDrill_inch: "No.50", pilotDrill_mm: 1.78, minorDia_mm: 1.695 },
  { designation: "#3-48", nominal_inch: "0.099\"", nominal_mm: 2.515, tpi: 48, pitch_mm: 0.529, pilotDrill_inch: "No.47", pilotDrill_mm: 2.00, minorDia_mm: 1.941 },
  { designation: "#4-40", nominal_inch: "0.112\"", nominal_mm: 2.845, tpi: 40, pitch_mm: 0.635, pilotDrill_inch: "No.43", pilotDrill_mm: 2.26, minorDia_mm: 2.157 },
  { designation: "#5-40", nominal_inch: "0.125\"", nominal_mm: 3.175, tpi: 40, pitch_mm: 0.635, pilotDrill_inch: "No.38", pilotDrill_mm: 2.57, minorDia_mm: 2.487 },
  { designation: "#6-32", nominal_inch: "0.138\"", nominal_mm: 3.505, tpi: 32, pitch_mm: 0.794, pilotDrill_inch: "No.36", pilotDrill_mm: 2.71, minorDia_mm: 2.642 },
  { designation: "#8-32", nominal_inch: "0.164\"", nominal_mm: 4.166, tpi: 32, pitch_mm: 0.794, pilotDrill_inch: "No.29", pilotDrill_mm: 3.45, minorDia_mm: 3.302 },
  { designation: "#10-24", nominal_inch: "0.190\"", nominal_mm: 4.826, tpi: 24, pitch_mm: 1.058, pilotDrill_inch: "No.25", pilotDrill_mm: 3.80, minorDia_mm: 3.683 },
  { designation: "#12-24", nominal_inch: "0.216\"", nominal_mm: 5.486, tpi: 24, pitch_mm: 1.058, pilotDrill_inch: "No.16", pilotDrill_mm: 4.50, minorDia_mm: 4.344 },
  { designation: "1/4\"-20", nominal_inch: "0.250\"", nominal_mm: 6.350, tpi: 20, pitch_mm: 1.270, pilotDrill_inch: "No.7", pilotDrill_mm: 5.11, minorDia_mm: 4.976 },
  { designation: "5/16\"-18", nominal_inch: "0.3125\"", nominal_mm: 7.938, tpi: 18, pitch_mm: 1.411, pilotDrill_inch: "F", pilotDrill_mm: 6.53, minorDia_mm: 6.401 },
  { designation: "3/8\"-16", nominal_inch: "0.375\"", nominal_mm: 9.525, tpi: 16, pitch_mm: 1.588, pilotDrill_inch: "5/16\"", pilotDrill_mm: 7.94, minorDia_mm: 7.798 },
  { designation: "7/16\"-14", nominal_inch: "0.4375\"", nominal_mm: 11.113, tpi: 14, pitch_mm: 1.814, pilotDrill_inch: "U", pilotDrill_mm: 9.35, minorDia_mm: 9.144 },
  { designation: "1/2\"-13", nominal_inch: "0.500\"", nominal_mm: 12.700, tpi: 13, pitch_mm: 1.954, pilotDrill_inch: "27/64\"", pilotDrill_mm: 10.72, minorDia_mm: 10.584 },
  { designation: "9/16\"-12", nominal_inch: "0.5625\"", nominal_mm: 14.288, tpi: 12, pitch_mm: 2.117, pilotDrill_inch: "31/64\"", pilotDrill_mm: 12.30, minorDia_mm: 11.989 },
  { designation: "5/8\"-11", nominal_inch: "0.625\"", nominal_mm: 15.875, tpi: 11, pitch_mm: 2.309, pilotDrill_inch: "17/32\"", pilotDrill_mm: 13.49, minorDia_mm: 13.386 },
  { designation: "3/4\"-10", nominal_inch: "0.750\"", nominal_mm: 19.050, tpi: 10, pitch_mm: 2.540, pilotDrill_inch: "21/32\"", pilotDrill_mm: 16.67, minorDia_mm: 16.307 },
  { designation: "7/8\"-9", nominal_inch: "0.875\"", nominal_mm: 22.225, tpi: 9, pitch_mm: 2.822, pilotDrill_inch: "49/64\"", pilotDrill_mm: 19.45, minorDia_mm: 19.177 },
  { designation: "1\"-8", nominal_inch: "1.000\"", nominal_mm: 25.400, tpi: 8, pitch_mm: 3.175, pilotDrill_inch: "7/8\"", pilotDrill_mm: 22.23, minorDia_mm: 21.971 },
];

// ── UNF (Unified National Fine) ──
const unfPitches: UNCRow[] = [
  { designation: "#0-80", nominal_inch: "0.060\"", nominal_mm: 1.524, tpi: 80, pitch_mm: 0.318, pilotDrill_inch: "3/64\"", pilotDrill_mm: 1.19, minorDia_mm: 1.181 },
  { designation: "#1-72", nominal_inch: "0.073\"", nominal_mm: 1.854, tpi: 72, pitch_mm: 0.353, pilotDrill_inch: "No.53", pilotDrill_mm: 1.50, minorDia_mm: 1.473 },
  { designation: "#2-64", nominal_inch: "0.086\"", nominal_mm: 2.184, tpi: 64, pitch_mm: 0.397, pilotDrill_inch: "No.50", pilotDrill_mm: 1.78, minorDia_mm: 1.757 },
  { designation: "#4-48", nominal_inch: "0.112\"", nominal_mm: 2.845, tpi: 48, pitch_mm: 0.529, pilotDrill_inch: "No.42", pilotDrill_mm: 2.37, minorDia_mm: 2.269 },
  { designation: "#6-40", nominal_inch: "0.138\"", nominal_mm: 3.505, tpi: 40, pitch_mm: 0.635, pilotDrill_inch: "No.33", pilotDrill_mm: 2.87, minorDia_mm: 2.817 },
  { designation: "#8-36", nominal_inch: "0.164\"", nominal_mm: 4.166, tpi: 36, pitch_mm: 0.706, pilotDrill_inch: "No.29", pilotDrill_mm: 3.45, minorDia_mm: 3.404 },
  { designation: "#10-32", nominal_inch: "0.190\"", nominal_mm: 4.826, tpi: 32, pitch_mm: 0.794, pilotDrill_inch: "No.21", pilotDrill_mm: 4.04, minorDia_mm: 3.962 },
  { designation: "1/4\"-28", nominal_inch: "0.250\"", nominal_mm: 6.350, tpi: 28, pitch_mm: 0.907, pilotDrill_inch: "No.3", pilotDrill_mm: 5.41, minorDia_mm: 5.372 },
  { designation: "5/16\"-24", nominal_inch: "0.3125\"", nominal_mm: 7.938, tpi: 24, pitch_mm: 1.058, pilotDrill_inch: "I", pilotDrill_mm: 6.91, minorDia_mm: 6.795 },
  { designation: "3/8\"-24", nominal_inch: "0.375\"", nominal_mm: 9.525, tpi: 24, pitch_mm: 1.058, pilotDrill_inch: "Q", pilotDrill_mm: 8.51, minorDia_mm: 8.382 },
  { designation: "7/16\"-20", nominal_inch: "0.4375\"", nominal_mm: 11.113, tpi: 20, pitch_mm: 1.270, pilotDrill_inch: "25/64\"", pilotDrill_mm: 9.92, minorDia_mm: 9.738 },
  { designation: "1/2\"-20", nominal_inch: "0.500\"", nominal_mm: 12.700, tpi: 20, pitch_mm: 1.270, pilotDrill_inch: "29/64\"", pilotDrill_mm: 11.51, minorDia_mm: 11.326 },
  { designation: "9/16\"-18", nominal_inch: "0.5625\"", nominal_mm: 14.288, tpi: 18, pitch_mm: 1.411, pilotDrill_inch: "33/64\"", pilotDrill_mm: 13.10, minorDia_mm: 12.751 },
  { designation: "5/8\"-18", nominal_inch: "0.625\"", nominal_mm: 15.875, tpi: 18, pitch_mm: 1.411, pilotDrill_inch: "37/64\"", pilotDrill_mm: 14.68, minorDia_mm: 14.338 },
  { designation: "3/4\"-16", nominal_inch: "0.750\"", nominal_mm: 19.050, tpi: 16, pitch_mm: 1.588, pilotDrill_inch: "11/16\"", pilotDrill_mm: 17.46, minorDia_mm: 17.323 },
  { designation: "1\"-12", nominal_inch: "1.000\"", nominal_mm: 25.400, tpi: 12, pitch_mm: 2.117, pilotDrill_inch: "59/64\"", pilotDrill_mm: 23.40, minorDia_mm: 23.098 },
];

// ── BSP (British Standard Pipe) ──
interface BSPRow {
  designation: string;
  od_mm: number;
  tpi: number;
  pitch_mm: number;
  pilotDrill_mm: number;
  minorDia_mm: number;
}

const bspPitches: BSPRow[] = [
  { designation: "G1/8\"", od_mm: 9.728, tpi: 28, pitch_mm: 0.907, pilotDrill_mm: 8.60, minorDia_mm: 8.566 },
  { designation: "G1/4\"", od_mm: 13.157, tpi: 19, pitch_mm: 1.337, pilotDrill_mm: 11.50, minorDia_mm: 11.445 },
  { designation: "G3/8\"", od_mm: 16.662, tpi: 19, pitch_mm: 1.337, pilotDrill_mm: 15.00, minorDia_mm: 14.950 },
  { designation: "G1/2\"", od_mm: 20.955, tpi: 14, pitch_mm: 1.814, pilotDrill_mm: 18.60, minorDia_mm: 18.631 },
  { designation: "G5/8\"", od_mm: 22.911, tpi: 14, pitch_mm: 1.814, pilotDrill_mm: 20.60, minorDia_mm: 20.587 },
  { designation: "G3/4\"", od_mm: 26.441, tpi: 14, pitch_mm: 1.814, pilotDrill_mm: 24.10, minorDia_mm: 24.117 },
  { designation: "G1\"", od_mm: 33.249, tpi: 11, pitch_mm: 2.309, pilotDrill_mm: 30.30, minorDia_mm: 30.291 },
  { designation: "G1-1/4\"", od_mm: 41.910, tpi: 11, pitch_mm: 2.309, pilotDrill_mm: 38.90, minorDia_mm: 38.952 },
  { designation: "G1-1/2\"", od_mm: 47.803, tpi: 11, pitch_mm: 2.309, pilotDrill_mm: 44.80, minorDia_mm: 44.845 },
  { designation: "G2\"", od_mm: 59.614, tpi: 11, pitch_mm: 2.309, pilotDrill_mm: 56.60, minorDia_mm: 56.656 },
];

// ── NPT (National Pipe Thread) ──
const nptPitches: BSPRow[] = [
  { designation: "1/8\" NPT", od_mm: 10.287, tpi: 27, pitch_mm: 0.941, pilotDrill_mm: 8.70, minorDia_mm: 8.766 },
  { designation: "1/4\" NPT", od_mm: 13.716, tpi: 18, pitch_mm: 1.411, pilotDrill_mm: 11.10, minorDia_mm: 11.113 },
  { designation: "3/8\" NPT", od_mm: 17.145, tpi: 18, pitch_mm: 1.411, pilotDrill_mm: 14.50, minorDia_mm: 14.543 },
  { designation: "1/2\" NPT", od_mm: 21.336, tpi: 14, pitch_mm: 1.814, pilotDrill_mm: 18.00, minorDia_mm: 17.932 },
  { designation: "3/4\" NPT", od_mm: 26.670, tpi: 14, pitch_mm: 1.814, pilotDrill_mm: 23.30, minorDia_mm: 23.267 },
  { designation: "1\" NPT", od_mm: 33.401, tpi: 11.5, pitch_mm: 2.209, pilotDrill_mm: 29.50, minorDia_mm: 29.504 },
  { designation: "1-1/4\" NPT", od_mm: 42.164, tpi: 11.5, pitch_mm: 2.209, pilotDrill_mm: 38.30, minorDia_mm: 38.267 },
  { designation: "1-1/2\" NPT", od_mm: 48.260, tpi: 11.5, pitch_mm: 2.209, pilotDrill_mm: 44.40, minorDia_mm: 44.363 },
  { designation: "2\" NPT", od_mm: 60.325, tpi: 11.5, pitch_mm: 2.209, pilotDrill_mm: 56.40, minorDia_mm: 56.427 },
];

// ── Trapezoidal (Tr - DIN 103) ──
interface TrapezoidalRow {
  designation: string;
  nominal: number;
  pitch: number;
  minorDia: number;
  pitchDia: number;
  threadDepth: number;
}

const trapezoidalPitches: TrapezoidalRow[] = [
  { designation: "Tr 8×1.5", nominal: 8, pitch: 1.5, minorDia: 6.2, pitchDia: 7.25, threadDepth: 0.75 },
  { designation: "Tr 10×2", nominal: 10, pitch: 2.0, minorDia: 7.5, pitchDia: 9.0, threadDepth: 1.0 },
  { designation: "Tr 12×3", nominal: 12, pitch: 3.0, minorDia: 8.5, pitchDia: 10.5, threadDepth: 1.5 },
  { designation: "Tr 14×3", nominal: 14, pitch: 3.0, minorDia: 10.5, pitchDia: 12.5, threadDepth: 1.5 },
  { designation: "Tr 16×4", nominal: 16, pitch: 4.0, minorDia: 11.5, pitchDia: 14.0, threadDepth: 2.0 },
  { designation: "Tr 18×4", nominal: 18, pitch: 4.0, minorDia: 13.5, pitchDia: 16.0, threadDepth: 2.0 },
  { designation: "Tr 20×4", nominal: 20, pitch: 4.0, minorDia: 15.5, pitchDia: 18.0, threadDepth: 2.0 },
  { designation: "Tr 22×5", nominal: 22, pitch: 5.0, minorDia: 16.5, pitchDia: 19.5, threadDepth: 2.5 },
  { designation: "Tr 24×5", nominal: 24, pitch: 5.0, minorDia: 18.5, pitchDia: 21.5, threadDepth: 2.5 },
  { designation: "Tr 26×5", nominal: 26, pitch: 5.0, minorDia: 20.5, pitchDia: 23.5, threadDepth: 2.5 },
  { designation: "Tr 28×5", nominal: 28, pitch: 5.0, minorDia: 22.5, pitchDia: 25.5, threadDepth: 2.5 },
  { designation: "Tr 30×6", nominal: 30, pitch: 6.0, minorDia: 23.0, pitchDia: 27.0, threadDepth: 3.0 },
  { designation: "Tr 36×6", nominal: 36, pitch: 6.0, minorDia: 29.0, pitchDia: 33.0, threadDepth: 3.0 },
  { designation: "Tr 40×7", nominal: 40, pitch: 7.0, minorDia: 32.0, pitchDia: 36.5, threadDepth: 3.5 },
  { designation: "Tr 44×7", nominal: 44, pitch: 7.0, minorDia: 36.0, pitchDia: 40.5, threadDepth: 3.5 },
  { designation: "Tr 48×8", nominal: 48, pitch: 8.0, minorDia: 39.0, pitchDia: 44.0, threadDepth: 4.0 },
];

/* ═══════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════ */

const ThreadPitchReference = () => {
  const [search, setSearch] = useState("");

  const filterRows = <T extends { designation: string }>(rows: T[]) =>
    rows.filter((r) => r.designation.toLowerCase().includes(search.toLowerCase()));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-foreground text-base flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Diş Adımı Referans Tabloları
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          ISO Metrik, UNC, UNF, BSP, NPT ve Trapez diş standartlarının kapsamlı referansı
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Diş boyutu ara (ör: M10, 1/2, G3/4)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background border-border"
          />
        </div>

        <Tabs defaultValue="metric-coarse" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
            <TabsTrigger value="metric-coarse" className="text-xs">Metrik Kaba</TabsTrigger>
            <TabsTrigger value="metric-fine" className="text-xs">Metrik İnce</TabsTrigger>
            <TabsTrigger value="unc" className="text-xs">UNC</TabsTrigger>
            <TabsTrigger value="unf" className="text-xs">UNF</TabsTrigger>
            <TabsTrigger value="bsp" className="text-xs">BSP</TabsTrigger>
            <TabsTrigger value="npt" className="text-xs">NPT</TabsTrigger>
            <TabsTrigger value="trapezoidal" className="text-xs">Trapez</TabsTrigger>
          </TabsList>

          {/* ── Metric Coarse ── */}
          <TabsContent value="metric-coarse">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-primary/40 text-primary text-xs">ISO 261 / DIN 13</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(metricCoarsePitches).length} sonuç</span>
            </div>
            <MetricTable rows={filterRows(metricCoarsePitches)} />
          </TabsContent>

          {/* ── Metric Fine ── */}
          <TabsContent value="metric-fine">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-primary/40 text-primary text-xs">ISO 261 / DIN 13</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(metricFinePitches).length} sonuç</span>
            </div>
            <MetricTable rows={filterRows(metricFinePitches)} />
          </TabsContent>

          {/* ── UNC ── */}
          <TabsContent value="unc">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-warning/40 text-warning text-xs">ANSI/ASME B1.1</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(uncPitches).length} sonuç</span>
            </div>
            <InchTable rows={filterRows(uncPitches)} title="UNC — Unified National Coarse" />
          </TabsContent>

          {/* ── UNF ── */}
          <TabsContent value="unf">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-warning/40 text-warning text-xs">ANSI/ASME B1.1</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(unfPitches).length} sonuç</span>
            </div>
            <InchTable rows={filterRows(unfPitches)} title="UNF — Unified National Fine" />
          </TabsContent>

          {/* ── BSP ── */}
          <TabsContent value="bsp">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-accent/40 text-accent-foreground text-xs">BS EN ISO 228-1</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(bspPitches).length} sonuç</span>
            </div>
            <PipeTable rows={filterRows(bspPitches)} />
          </TabsContent>

          {/* ── NPT ── */}
          <TabsContent value="npt">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-accent/40 text-accent-foreground text-xs">ANSI/ASME B1.20.1</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(nptPitches).length} sonuç</span>
            </div>
            <PipeTable rows={filterRows(nptPitches)} />
          </TabsContent>

          {/* ── Trapezoidal ── */}
          <TabsContent value="trapezoidal">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="border-success/40 text-success text-xs">DIN 103</Badge>
              <span className="text-xs text-muted-foreground">{filterRows(trapezoidalPitches).length} sonuç</span>
            </div>
            <TrapezoidalTable rows={filterRows(trapezoidalPitches)} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

/* ── Sub-tables ── */

function MetricTable({ rows }: { rows: ThreadPitchRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30">
            <TableHead className="text-xs font-semibold">Diş</TableHead>
            <TableHead className="text-xs font-semibold text-right">Nominal Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Adım (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Ön Delme (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">İç Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Hatve Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Diş Der. (mm)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.designation} className="hover:bg-secondary/20">
              <TableCell className="font-mono font-medium text-primary text-sm">{r.designation}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.nominal.toFixed(1)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">{r.pitch.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm text-success">{r.pilotDrill.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.minorDia.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.pitchDia.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.threadDepth.toFixed(3)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sonuç bulunamadı</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function InchTable({ rows, title }: { rows: UNCRow[]; title: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30">
            <TableHead className="text-xs font-semibold">Diş</TableHead>
            <TableHead className="text-xs font-semibold text-right">Nom. (inch)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Nom. (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">TPI</TableHead>
            <TableHead className="text-xs font-semibold text-right">Adım (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Ön Delme</TableHead>
            <TableHead className="text-xs font-semibold text-right">Ön Delme (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">İç Ø (mm)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.designation} className="hover:bg-secondary/20">
              <TableCell className="font-mono font-medium text-primary text-sm">{r.designation}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.nominal_inch}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.nominal_mm.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">{r.tpi}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">{r.pitch_mm.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono text-sm text-success">{r.pilotDrill_inch}</TableCell>
              <TableCell className="text-right font-mono text-sm text-success">{r.pilotDrill_mm.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.minorDia_mm.toFixed(3)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sonuç bulunamadı</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function PipeTable({ rows }: { rows: BSPRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30">
            <TableHead className="text-xs font-semibold">Diş</TableHead>
            <TableHead className="text-xs font-semibold text-right">Dış Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">TPI</TableHead>
            <TableHead className="text-xs font-semibold text-right">Adım (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Ön Delme (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">İç Ø (mm)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.designation} className="hover:bg-secondary/20">
              <TableCell className="font-mono font-medium text-primary text-sm">{r.designation}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.od_mm.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">{r.tpi}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">{r.pitch_mm.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono text-sm text-success">{r.pilotDrill_mm.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.minorDia_mm.toFixed(3)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sonuç bulunamadı</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TrapezoidalTable({ rows }: { rows: TrapezoidalRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30">
            <TableHead className="text-xs font-semibold">Diş</TableHead>
            <TableHead className="text-xs font-semibold text-right">Nominal Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Adım (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">İç Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Hatve Ø (mm)</TableHead>
            <TableHead className="text-xs font-semibold text-right">Diş Der. (mm)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.designation} className="hover:bg-secondary/20">
              <TableCell className="font-mono font-medium text-primary text-sm">{r.designation}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.nominal.toFixed(1)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">{r.pitch.toFixed(1)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.minorDia.toFixed(1)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.pitchDia.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono text-sm">{r.threadDepth.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sonuç bulunamadı</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default ThreadPitchReference;
