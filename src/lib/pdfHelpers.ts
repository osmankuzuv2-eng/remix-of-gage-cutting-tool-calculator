import jsPDF from "jspdf";
import logoUrl from "@/assets/logo.png";

// ── Font cache to avoid re-fetching ──
const fontCache: { regular?: string; bold?: string } = {};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const registerFonts = async (doc: jsPDF) => {
  try {
    if (!fontCache.regular || !fontCache.bold) {
      const [regRes, boldRes] = await Promise.all([
        fetch("/fonts/Roboto-Regular.ttf"),
        fetch("/fonts/Roboto-Bold.ttf"),
      ]);
      
      if (!regRes.ok || !boldRes.ok) {
        console.warn("Font fetch failed, using default font", regRes.status, boldRes.status);
        return;
      }
      
      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);
      
      if (regBuf.byteLength === 0 || boldBuf.byteLength === 0) {
        console.warn("Font files are empty, using default font");
        return;
      }
      
      fontCache.regular = arrayBufferToBase64(regBuf);
      fontCache.bold = arrayBufferToBase64(boldBuf);
    }

    doc.addFileToVFS("Roboto-Regular.ttf", fontCache.regular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", fontCache.bold);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto");
  } catch (err) {
    console.warn("Font registration failed, using default font:", err);
  }
};

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
  primary: [245, 124, 0] as [number, number, number],       // Orange
  primaryDark: [230, 100, 0] as [number, number, number],
  dark: [30, 35, 50] as [number, number, number],            // Dark navy
  darkAlt: [40, 45, 65] as [number, number, number],
  light: [248, 248, 252] as [number, number, number],
  muted: [140, 140, 160] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],        // Blue accent
  success: [34, 197, 94] as [number, number, number],
};

export const drawHeader = async (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header background bar
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, pageWidth, 28, "F");
  
  // Orange accent line
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 28, pageWidth, 1.5, "F");

  // Logo
  const logo = await loadLogoBase64();
  if (logo) {
    doc.addImage(logo, "PNG", margin, 3, 22, 22);
  }

  // Title text
  doc.setFont("Roboto", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND.white);
  doc.text(title, margin + 26, 13);

  // Subtitle
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 185, 200);
  doc.text("GAGE Confidence ToolSense", margin + 26, 19);

  // Date on right
  doc.setFontSize(7);
  doc.setTextColor(180, 185, 200);
  const dateStr = new Date().toLocaleDateString("tr-TR") + " " + new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  doc.text(dateStr, pageWidth - margin, 19, { align: "right" });

  doc.setTextColor(0, 0, 0);
  return 34; // y position after header
};

export const drawFooter = (doc: jsPDF, footerText: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Footer line
    doc.setFillColor(...BRAND.primary);
    doc.rect(margin, pageHeight - 12, pageWidth - margin * 2, 0.5, "F");
    
    doc.setFont("Roboto", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.muted);
    doc.text(footerText, margin, pageHeight - 7);
    doc.text(`Sayfa ${i}/${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    
    // Small logo mark
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.primary);
    doc.text("GAGE Confidence", pageWidth / 2, pageHeight - 7, { align: "center" });
  }
};

export const sectionTitle = (doc: jsPDF, text: string, y: number, margin: number): number => {
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.dark);
  doc.text(text, margin, y);
  // Orange underline
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
  const boxH = 18;
  // Box background
  doc.setFillColor(...BRAND.light);
  doc.setDrawColor(220, 220, 230);
  doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, "FD");
  
  // Orange top accent
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, contentWidth, 1.5, "F");

  const colW = contentWidth / items.length;
  items.forEach((item, i) => {
    const x = margin + colW * i + colW / 2;
    doc.setFont("Roboto", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...BRAND.muted);
    doc.text(item.label, x, y + 6, { align: "center" });
    
    doc.setFont("Roboto", "bold");
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
  doc.setFillColor(...BRAND.dark);
  doc.rect(margin, y, contentWidth, 7, "F");
  // Orange accent on top of header
  doc.setFillColor(...BRAND.primary);
  doc.rect(margin, y, contentWidth, 0.8, "F");
  
  doc.setFontSize(6.5);
  doc.setFont("Roboto", "bold");
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
  const rowH = 7;
  if (isEven) {
    doc.setFillColor(245, 246, 250);
    doc.rect(margin, y, contentWidth, rowH, "F");
  }
  doc.setFontSize(6.5);
  doc.setFont("Roboto", "normal");
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
