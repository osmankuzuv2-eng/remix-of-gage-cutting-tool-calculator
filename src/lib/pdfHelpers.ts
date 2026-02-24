import jsPDF from "jspdf";
import logoUrl from "@/assets/logo.png";

// Font cache - cleared on module reload
let fontCache: { regular?: string; bold?: string } = {};
let fontsRegistered = false;

// Force cache clear on HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    fontCache = {};
    fontsRegistered = false;
  });
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  // Use chunks to avoid call stack issues with large fonts
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

/** Returns the font family name to use */
export const registerFonts = async (doc: jsPDF): Promise<string> => {
  try {
    if (!fontCache.regular || !fontCache.bold) {
      const [regRes, boldRes] = await Promise.all([
        fetch("/fonts/Aptos-Regular.ttf"),
        fetch("/fonts/Aptos-Bold.ttf"),
      ]);

      if (!regRes.ok || !boldRes.ok) {
        fontsRegistered = false;
        return "helvetica";
      }

      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);

      // Valid TTF files should be at least 10KB
      if (regBuf.byteLength < 10000 || boldBuf.byteLength < 10000) {
        console.warn(`Font files too small (Regular: ${regBuf.byteLength}B, Bold: ${boldBuf.byteLength}B) - using helvetica fallback`);
        fontsRegistered = false;
        return "helvetica";
      }

      fontCache.regular = arrayBufferToBase64(regBuf);
      fontCache.bold = arrayBufferToBase64(boldBuf);
    }

    doc.addFileToVFS("Aptos-Regular.ttf", fontCache.regular);
    doc.addFont("Aptos-Regular.ttf", "Aptos", "normal");
    doc.addFileToVFS("Aptos-Bold.ttf", fontCache.bold);
    doc.addFont("Aptos-Bold.ttf", "Aptos", "bold");
    doc.setFont("Aptos");
    fontsRegistered = true;
    return "Aptos";
  } catch (err) {
    console.warn("Font registration failed:", err);
    fontsRegistered = false;
    return "helvetica";
  }
};

/** Get the active font family name */
export const getFontFamily = (): string => fontsRegistered ? "Aptos" : "helvetica";

// ── Logo cache ──
let logoBase64Cache: string | null = null;

const loadLogoBase64 = (): Promise<string> => {
  if (logoBase64Cache) return Promise.resolve(logoBase64Cache);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      logoBase64Cache = canvas.toDataURL("image/png");
      resolve(logoBase64Cache);
    };
    img.onerror = () => resolve("");
    img.src = logoUrl;
  });
};

// Brand colors
export const BRAND = {
  primary: [56, 132, 244] as [number, number, number],
  primaryDark: [37, 99, 205] as [number, number, number],
  dark: [22, 26, 38] as [number, number, number],
  darkAlt: [32, 38, 55] as [number, number, number],
  light: [240, 242, 250] as [number, number, number],
  muted: [130, 140, 165] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  accent: [14, 165, 233] as [number, number, number],
  success: [40, 180, 120] as [number, number, number],
};

export const drawHeader = async (doc: jsPDF, title: string): Promise<number> => {
  const ff = getFontFamily();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Header background bar
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Orange accent line
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 28, pageWidth, 1.5, "F");

  // Logo
  const logo = await loadLogoBase64();
  if (logo) {
    try { doc.addImage(logo, "PNG", margin, 3, 22, 22); } catch { /* ignore */ }
  }

  // Title text
  doc.setFont(ff, "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.white);
  doc.text(title, margin + 26, 13);

  // Subtitle
  doc.setFont(ff, "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 185, 200);
  doc.text("GAGE Confidence ToolSense", margin + 26, 19);

  // Date on right
  doc.setFontSize(7);
  doc.setTextColor(180, 185, 200);
  const dateStr = new Date().toLocaleDateString("tr-TR") + " " + new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  doc.text(dateStr, pageWidth - margin, 19, { align: "right" });

  doc.setTextColor(0, 0, 0);
  return 34;
};

export const drawFooter = (doc: jsPDF, footerText: string, pageLabel: string = "Sayfa") => {
  const ff = getFontFamily();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...BRAND.primary);
    doc.rect(margin, pageHeight - 12, pageWidth - margin * 2, 0.5, "F");

    doc.setFont(ff, "normal");
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.muted);
    doc.text(footerText, margin, pageHeight - 7);
    doc.text(`${pageLabel} ${i}/${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.primary);
    doc.text("GAGE Confidence", pageWidth / 2, pageHeight - 7, { align: "center" });
  }
};

export const sectionTitle = (doc: jsPDF, text: string, y: number, margin: number): number => {
  const ff = getFontFamily();
  doc.setFont(ff, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.dark);
  doc.text(text, margin, y);
  const textWidth = doc.getTextWidth(text);
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y + 1, textWidth, 0.7, "F");
  return y + 7;
};

export const drawInfoBox = (
  doc: jsPDF,
  y: number,
  margin: number,
  contentWidth: number,
  items: { label: string; value: string }[]
): number => {
  const ff = getFontFamily();
  const boxH = 18;
  doc.setFillColor(...BRAND.light);
  doc.setDrawColor(220, 220, 230);
  doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, "FD");

  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, contentWidth, 1.5, "F");

  const colW = contentWidth / items.length;
  items.forEach((item, i) => {
    const x = margin + colW * i + colW / 2;
    doc.setFont(ff, "normal");
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.muted);
    doc.text(item.label, x, y + 6, { align: "center" });

    doc.setFont(ff, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.dark);
    const val = item.value.length > 24 ? item.value.substring(0, 22) + ".." : item.value;
    doc.text(val, x, y + 13, { align: "center" });
  });

  return y + boxH + 4;
};

export const drawTableHeader = (
  doc: jsPDF,
  y: number,
  margin: number,
  contentWidth: number,
  headers: string[],
  scaledCols: number[]
): number => {
  const ff = getFontFamily();
  doc.setFillColor(...BRAND.dark);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, contentWidth, 0.8, "F");

  doc.setFontSize(6.5);
  doc.setFont(ff, "bold");
  doc.setTextColor(...BRAND.white);
  let tx = margin + 1.5;
  headers.forEach((h, i) => {
    doc.text(h, tx, y + 5);
    tx += scaledCols[i];
  });
  doc.setTextColor(0, 0, 0);
  return y + 7;
};

export const drawTableRow = (
  doc: jsPDF,
  y: number,
  margin: number,
  contentWidth: number,
  cells: string[],
  scaledCols: number[],
  isEven: boolean
): number => {
  const ff = getFontFamily();
  const rowH = 7;
  if (isEven) {
    doc.setFillColor(245, 246, 250);
    doc.rect(margin, y, contentWidth, rowH, "F");
  }
  doc.setFontSize(6.5);
  doc.setFont(ff, "normal");
  doc.setTextColor(50, 50, 60);
  let tx = margin + 1.5;
  cells.forEach((cell, i) => {
    const maxChars = Math.floor(scaledCols[i] / 1.8);
    const truncated = cell.length > maxChars ? cell.substring(0, maxChars - 1) + ".." : cell;
    doc.text(truncated, tx, y + 5);
    tx += scaledCols[i];
  });
  return y + rowH;
};
