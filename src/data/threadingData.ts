// Metric Thread Standards (ISO)
export interface MetricThread {
  designation: string;
  nominalDiameter: number; // mm
  pitch: number; // mm
  minorDiameter: number; // mm
  pilotDrillDiameter: number; // mm
  threadDepth: number; // mm
}

export const metricCoarseThreads: MetricThread[] = [
  { designation: "M3", nominalDiameter: 3, pitch: 0.5, minorDiameter: 2.459, pilotDrillDiameter: 2.5, threadDepth: 0.307 },
  { designation: "M4", nominalDiameter: 4, pitch: 0.7, minorDiameter: 3.242, pilotDrillDiameter: 3.3, threadDepth: 0.429 },
  { designation: "M5", nominalDiameter: 5, pitch: 0.8, minorDiameter: 4.134, pilotDrillDiameter: 4.2, threadDepth: 0.491 },
  { designation: "M6", nominalDiameter: 6, pitch: 1.0, minorDiameter: 4.917, pilotDrillDiameter: 5.0, threadDepth: 0.613 },
  { designation: "M8", nominalDiameter: 8, pitch: 1.25, minorDiameter: 6.647, pilotDrillDiameter: 6.8, threadDepth: 0.767 },
  { designation: "M10", nominalDiameter: 10, pitch: 1.5, minorDiameter: 8.376, pilotDrillDiameter: 8.5, threadDepth: 0.920 },
  { designation: "M12", nominalDiameter: 12, pitch: 1.75, minorDiameter: 10.106, pilotDrillDiameter: 10.2, threadDepth: 1.074 },
  { designation: "M14", nominalDiameter: 14, pitch: 2.0, minorDiameter: 11.835, pilotDrillDiameter: 12.0, threadDepth: 1.227 },
  { designation: "M16", nominalDiameter: 16, pitch: 2.0, minorDiameter: 13.835, pilotDrillDiameter: 14.0, threadDepth: 1.227 },
  { designation: "M18", nominalDiameter: 18, pitch: 2.5, minorDiameter: 15.294, pilotDrillDiameter: 15.5, threadDepth: 1.534 },
  { designation: "M20", nominalDiameter: 20, pitch: 2.5, minorDiameter: 17.294, pilotDrillDiameter: 17.5, threadDepth: 1.534 },
  { designation: "M22", nominalDiameter: 22, pitch: 2.5, minorDiameter: 19.294, pilotDrillDiameter: 19.5, threadDepth: 1.534 },
  { designation: "M24", nominalDiameter: 24, pitch: 3.0, minorDiameter: 20.752, pilotDrillDiameter: 21.0, threadDepth: 1.840 },
  { designation: "M27", nominalDiameter: 27, pitch: 3.0, minorDiameter: 23.752, pilotDrillDiameter: 24.0, threadDepth: 1.840 },
  { designation: "M30", nominalDiameter: 30, pitch: 3.5, minorDiameter: 26.211, pilotDrillDiameter: 26.5, threadDepth: 2.147 },
];

export const metricFineThreads: MetricThread[] = [
  { designation: "M6x0.75", nominalDiameter: 6, pitch: 0.75, minorDiameter: 5.188, pilotDrillDiameter: 5.2, threadDepth: 0.460 },
  { designation: "M8x1", nominalDiameter: 8, pitch: 1.0, minorDiameter: 6.917, pilotDrillDiameter: 7.0, threadDepth: 0.613 },
  { designation: "M10x1", nominalDiameter: 10, pitch: 1.0, minorDiameter: 8.917, pilotDrillDiameter: 9.0, threadDepth: 0.613 },
  { designation: "M10x1.25", nominalDiameter: 10, pitch: 1.25, minorDiameter: 8.647, pilotDrillDiameter: 8.8, threadDepth: 0.767 },
  { designation: "M12x1.25", nominalDiameter: 12, pitch: 1.25, minorDiameter: 10.647, pilotDrillDiameter: 10.8, threadDepth: 0.767 },
  { designation: "M12x1.5", nominalDiameter: 12, pitch: 1.5, minorDiameter: 10.376, pilotDrillDiameter: 10.5, threadDepth: 0.920 },
  { designation: "M14x1.5", nominalDiameter: 14, pitch: 1.5, minorDiameter: 12.376, pilotDrillDiameter: 12.5, threadDepth: 0.920 },
  { designation: "M16x1.5", nominalDiameter: 16, pitch: 1.5, minorDiameter: 14.376, pilotDrillDiameter: 14.5, threadDepth: 0.920 },
  { designation: "M18x1.5", nominalDiameter: 18, pitch: 1.5, minorDiameter: 16.376, pilotDrillDiameter: 16.5, threadDepth: 0.920 },
  { designation: "M20x1.5", nominalDiameter: 20, pitch: 1.5, minorDiameter: 18.376, pilotDrillDiameter: 18.5, threadDepth: 0.920 },
  { designation: "M20x2", nominalDiameter: 20, pitch: 2.0, minorDiameter: 17.835, pilotDrillDiameter: 18.0, threadDepth: 1.227 },
  { designation: "M24x2", nominalDiameter: 24, pitch: 2.0, minorDiameter: 21.835, pilotDrillDiameter: 22.0, threadDepth: 1.227 },
];

// UNC (Unified National Coarse) Threads
export interface InchThread {
  designation: string;
  nominalDiameter: number; // inches
  tpi: number; // threads per inch
  minorDiameter: number; // inches
  pilotDrillDiameter: number; // inches
  pilotDrillDiameterMM: number; // mm
}

export const uncThreads: InchThread[] = [
  { designation: "#4-40", nominalDiameter: 0.112, tpi: 40, minorDiameter: 0.0813, pilotDrillDiameter: 0.089, pilotDrillDiameterMM: 2.26 },
  { designation: "#6-32", nominalDiameter: 0.138, tpi: 32, minorDiameter: 0.0997, pilotDrillDiameter: 0.1065, pilotDrillDiameterMM: 2.71 },
  { designation: "#8-32", nominalDiameter: 0.164, tpi: 32, minorDiameter: 0.1257, pilotDrillDiameter: 0.1360, pilotDrillDiameterMM: 3.45 },
  { designation: "#10-24", nominalDiameter: 0.190, tpi: 24, minorDiameter: 0.1389, pilotDrillDiameter: 0.1495, pilotDrillDiameterMM: 3.80 },
  { designation: "1/4-20", nominalDiameter: 0.250, tpi: 20, minorDiameter: 0.1887, pilotDrillDiameter: 0.201, pilotDrillDiameterMM: 5.11 },
  { designation: "5/16-18", nominalDiameter: 0.3125, tpi: 18, minorDiameter: 0.2443, pilotDrillDiameter: 0.257, pilotDrillDiameterMM: 6.53 },
  { designation: "3/8-16", nominalDiameter: 0.375, tpi: 16, minorDiameter: 0.2983, pilotDrillDiameter: 0.3125, pilotDrillDiameterMM: 7.94 },
  { designation: "7/16-14", nominalDiameter: 0.4375, tpi: 14, minorDiameter: 0.3499, pilotDrillDiameter: 0.368, pilotDrillDiameterMM: 9.35 },
  { designation: "1/2-13", nominalDiameter: 0.500, tpi: 13, minorDiameter: 0.4056, pilotDrillDiameter: 0.4219, pilotDrillDiameterMM: 10.72 },
  { designation: "9/16-12", nominalDiameter: 0.5625, tpi: 12, minorDiameter: 0.4603, pilotDrillDiameter: 0.4844, pilotDrillDiameterMM: 12.30 },
  { designation: "5/8-11", nominalDiameter: 0.625, tpi: 11, minorDiameter: 0.5135, pilotDrillDiameter: 0.5312, pilotDrillDiameterMM: 13.49 },
  { designation: "3/4-10", nominalDiameter: 0.750, tpi: 10, minorDiameter: 0.6273, pilotDrillDiameter: 0.6562, pilotDrillDiameterMM: 16.67 },
];

// Thread cutting parameters by material
export interface ThreadCuttingParams {
  materialCategory: string;
  cuttingSpeedRange: [number, number]; // m/min
  feedMultiplier: number; // multiplier of pitch
  recommendedPasses: number;
  coolantRequired: boolean;
}

export const threadCuttingParams: ThreadCuttingParams[] = [
  { materialCategory: "Çelik (Düşük Karbonlu)", cuttingSpeedRange: [15, 25], feedMultiplier: 1.0, recommendedPasses: 4, coolantRequired: true },
  { materialCategory: "Çelik (Orta Karbonlu)", cuttingSpeedRange: [12, 20], feedMultiplier: 1.0, recommendedPasses: 5, coolantRequired: true },
  { materialCategory: "Çelik (Yüksek Karbonlu)", cuttingSpeedRange: [8, 15], feedMultiplier: 1.0, recommendedPasses: 6, coolantRequired: true },
  { materialCategory: "Paslanmaz Çelik", cuttingSpeedRange: [8, 15], feedMultiplier: 0.9, recommendedPasses: 6, coolantRequired: true },
  { materialCategory: "Dökme Demir", cuttingSpeedRange: [15, 25], feedMultiplier: 1.0, recommendedPasses: 4, coolantRequired: false },
  { materialCategory: "Alüminyum", cuttingSpeedRange: [40, 80], feedMultiplier: 1.0, recommendedPasses: 3, coolantRequired: true },
  { materialCategory: "Bronz", cuttingSpeedRange: [20, 35], feedMultiplier: 1.0, recommendedPasses: 4, coolantRequired: true },
  { materialCategory: "Pirinç", cuttingSpeedRange: [25, 45], feedMultiplier: 1.0, recommendedPasses: 3, coolantRequired: false },
  { materialCategory: "Bakır", cuttingSpeedRange: [20, 35], feedMultiplier: 1.0, recommendedPasses: 4, coolantRequired: true },
  { materialCategory: "Titanyum", cuttingSpeedRange: [5, 12], feedMultiplier: 0.8, recommendedPasses: 8, coolantRequired: true },
];

// Tap types
export interface TapType {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  speedMultiplier: number;
}

export const tapTypes: TapType[] = [
  {
    id: "spiral-point",
    name: "Spiral Point (Uzun Ağızlı)",
    description: "Talaşları ileri iter, kör delikler için uygun değil",
    bestFor: ["Geçme delikler", "Seri üretim", "CNC işleme"],
    speedMultiplier: 1.2,
  },
  {
    id: "spiral-flute",
    name: "Spiral Flute (Helis Kanallı)",
    description: "Talaşları yukarı çıkarır, kör delikler için ideal",
    bestFor: ["Kör delikler", "Uzun talaş malzemeler", "Alüminyum"],
    speedMultiplier: 1.0,
  },
  {
    id: "straight-flute",
    name: "Straight Flute (Düz Kanallı)",
    description: "Genel amaçlı, kısa talaş malzemeler için",
    bestFor: ["Dökme demir", "Bronz", "Pirinç", "Kısa talaş malzemeler"],
    speedMultiplier: 0.9,
  },
  {
    id: "form-tap",
    name: "Form Tap (Talaşsız)",
    description: "Talaş çıkarmaz, malzemeyi şekillendirir",
    bestFor: ["Alüminyum", "Bakır", "Düşük karbonlu çelik", "Yüksek mukavemet gereken"],
    speedMultiplier: 1.5,
  },
];

// Calculate thread depth for metric threads
export const calculateMetricThreadDepth = (pitch: number): number => {
  return pitch * 0.6134;
};

// Calculate RPM for threading
export const calculateThreadingRPM = (cuttingSpeed: number, diameter: number): number => {
  return (cuttingSpeed * 1000) / (Math.PI * diameter);
};

// Calculate torque for tapping (approximate formula)
export const calculateTappingTorque = (
  diameter: number,
  pitch: number,
  materialFactor: number = 1.0
): number => {
  // Approximate torque in Nm
  // T = K * d^2 * P * f
  const K = 0.0015; // constant
  return K * Math.pow(diameter, 2) * pitch * materialFactor;
};
