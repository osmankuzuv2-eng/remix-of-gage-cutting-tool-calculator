// Grinding wheel types
export interface GrindingWheel {
  id: string;
  name: string;
  abrasiveType: string;
  grainSizes: string[];
  bondTypes: string[];
  bestFor: string[];
  maxSurfaceSpeed: number; // m/s
  temperatureSensitivity: "low" | "medium" | "high";
}

export const grindingWheels: GrindingWheel[] = [
  {
    id: "aluminum-oxide",
    name: "Alüminyum Oksit (Al₂O₃)",
    abrasiveType: "Konvansiyonel",
    grainSizes: ["46", "60", "80", "100", "120", "150", "180"],
    bondTypes: ["Vitrified", "Resinoid", "Rubber"],
    bestFor: ["Çelik", "Dökme demir", "Demir esaslı alaşımlar"],
    maxSurfaceSpeed: 35,
    temperatureSensitivity: "medium",
  },
  {
    id: "silicon-carbide",
    name: "Silisyum Karbür (SiC)",
    abrasiveType: "Konvansiyonel",
    grainSizes: ["46", "60", "80", "100", "120", "150"],
    bondTypes: ["Vitrified", "Resinoid"],
    bestFor: ["Demir dışı metaller", "Alüminyum", "Pirinç", "Cam", "Seramik"],
    maxSurfaceSpeed: 35,
    temperatureSensitivity: "low",
  },
  {
    id: "cbn",
    name: "Kübik Bor Nitrür (CBN)",
    abrasiveType: "Süper Aşındırıcı",
    grainSizes: ["80", "100", "120", "150", "180", "220"],
    bondTypes: ["Vitrified", "Resinoid", "Metal"],
    bestFor: ["Sertleştirilmiş çelik", "Süper alaşımlar", "Yüksek hız çelikleri"],
    maxSurfaceSpeed: 60,
    temperatureSensitivity: "low",
  },
  {
    id: "diamond",
    name: "Elmas",
    abrasiveType: "Süper Aşındırıcı",
    grainSizes: ["100", "120", "150", "180", "220", "320"],
    bondTypes: ["Resinoid", "Metal", "Vitrified"],
    bestFor: ["Karbür", "Seramik", "Cam", "Taş", "Demir dışı metaller"],
    maxSurfaceSpeed: 50,
    temperatureSensitivity: "high",
  },
];

// Grinding operation types
export interface GrindingOperation {
  id: string;
  name: string;
  description: string;
  typicalWheelSpeed: [number, number]; // m/s
  typicalWorkSpeed: [number, number]; // m/min
  typicalDepthOfCut: [number, number]; // mm
  typicalFeedRate: [number, number]; // mm/rev or mm/stroke
}

export const grindingOperations: GrindingOperation[] = [
  {
    id: "surface",
    name: "Düzlem Taşlama",
    description: "Düz yüzeylerin taşlanması",
    typicalWheelSpeed: [25, 35],
    typicalWorkSpeed: [10, 30],
    typicalDepthOfCut: [0.005, 0.05],
    typicalFeedRate: [0.5, 5],
  },
  {
    id: "cylindrical-external",
    name: "Silindirik Taşlama (Dış)",
    description: "Silindirik parçaların dış yüzeylerinin taşlanması",
    typicalWheelSpeed: [25, 35],
    typicalWorkSpeed: [15, 40],
    typicalDepthOfCut: [0.005, 0.03],
    typicalFeedRate: [0.3, 2],
  },
  {
    id: "cylindrical-internal",
    name: "Silindirik Taşlama (İç)",
    description: "Delik ve iç yüzeylerin taşlanması",
    typicalWheelSpeed: [20, 30],
    typicalWorkSpeed: [20, 50],
    typicalDepthOfCut: [0.003, 0.02],
    typicalFeedRate: [0.2, 1],
  },
  {
    id: "centerless",
    name: "Puntasız Taşlama",
    description: "Puntasız silindirik taşlama",
    typicalWheelSpeed: [25, 35],
    typicalWorkSpeed: [15, 60],
    typicalDepthOfCut: [0.01, 0.05],
    typicalFeedRate: [1, 10],
  },
  {
    id: "creep-feed",
    name: "Yavaş İlerlemeli Taşlama",
    description: "Derin kesme ile yavaş ilerleme",
    typicalWheelSpeed: [20, 30],
    typicalWorkSpeed: [0.1, 1],
    typicalDepthOfCut: [0.5, 6],
    typicalFeedRate: [0.1, 0.5],
  },
];

// Material-specific grinding parameters
export interface MaterialGrindingParams {
  materialCategory: string;
  recommendedWheels: string[];
  wheelSpeedMultiplier: number;
  depthOfCutMultiplier: number;
  coolantRequired: boolean;
  surfaceFinishRa: [number, number]; // μm achievable
}

export const materialGrindingParams: MaterialGrindingParams[] = [
  {
    materialCategory: "Çelik (Yumuşak)",
    recommendedWheels: ["aluminum-oxide"],
    wheelSpeedMultiplier: 1.0,
    depthOfCutMultiplier: 1.0,
    coolantRequired: true,
    surfaceFinishRa: [0.4, 1.6],
  },
  {
    materialCategory: "Çelik (Sertleştirilmiş)",
    recommendedWheels: ["cbn", "aluminum-oxide"],
    wheelSpeedMultiplier: 0.9,
    depthOfCutMultiplier: 0.7,
    coolantRequired: true,
    surfaceFinishRa: [0.1, 0.8],
  },
  {
    materialCategory: "Paslanmaz Çelik",
    recommendedWheels: ["aluminum-oxide", "cbn"],
    wheelSpeedMultiplier: 0.85,
    depthOfCutMultiplier: 0.8,
    coolantRequired: true,
    surfaceFinishRa: [0.2, 1.2],
  },
  {
    materialCategory: "Dökme Demir",
    recommendedWheels: ["aluminum-oxide", "silicon-carbide"],
    wheelSpeedMultiplier: 1.1,
    depthOfCutMultiplier: 1.2,
    coolantRequired: false,
    surfaceFinishRa: [0.8, 3.2],
  },
  {
    materialCategory: "Alüminyum",
    recommendedWheels: ["silicon-carbide"],
    wheelSpeedMultiplier: 1.2,
    depthOfCutMultiplier: 1.3,
    coolantRequired: true,
    surfaceFinishRa: [0.4, 1.6],
  },
  {
    materialCategory: "Karbür",
    recommendedWheels: ["diamond"],
    wheelSpeedMultiplier: 0.8,
    depthOfCutMultiplier: 0.5,
    coolantRequired: true,
    surfaceFinishRa: [0.05, 0.4],
  },
  {
    materialCategory: "Seramik",
    recommendedWheels: ["diamond"],
    wheelSpeedMultiplier: 0.7,
    depthOfCutMultiplier: 0.4,
    coolantRequired: true,
    surfaceFinishRa: [0.05, 0.2],
  },
  {
    materialCategory: "Titanyum",
    recommendedWheels: ["silicon-carbide", "cbn"],
    wheelSpeedMultiplier: 0.6,
    depthOfCutMultiplier: 0.5,
    coolantRequired: true,
    surfaceFinishRa: [0.2, 1.0],
  },
];

// Coolant types for grinding
export interface CoolantType {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  concentration: string;
}

export const coolantTypes: CoolantType[] = [
  {
    id: "soluble-oil",
    name: "Emülsiyon (Suda Çözünür Yağ)",
    description: "En yaygın kullanılan soğutucu",
    bestFor: ["Genel amaçlı taşlama", "Çelik", "Dökme demir"],
    concentration: "%3-10",
  },
  {
    id: "synthetic",
    name: "Sentetik Soğutucu",
    description: "Yağsız, şeffaf çözeltiler",
    bestFor: ["Hassas taşlama", "Görünürlük gereken işler"],
    concentration: "%2-5",
  },
  {
    id: "straight-oil",
    name: "Saf Yağ",
    description: "Yüksek yağlama kapasitesi",
    bestFor: ["Derin kesme taşlama", "Form taşlama", "Diş taşlama"],
    concentration: "100%",
  },
];

// Calculate grinding wheel RPM
export const calculateWheelRPM = (wheelDiameter: number, surfaceSpeed: number): number => {
  // surfaceSpeed in m/s, wheelDiameter in mm
  return (surfaceSpeed * 60 * 1000) / (Math.PI * wheelDiameter);
};

// Calculate workpiece RPM for cylindrical grinding
export const calculateWorkRPM = (workDiameter: number, workSpeed: number): number => {
  // workSpeed in m/min, workDiameter in mm
  return (workSpeed * 1000) / (Math.PI * workDiameter);
};

// Calculate material removal rate
export const calculateMRR = (
  depthOfCut: number,
  feedRate: number,
  wheelWidth: number
): number => {
  // Returns mm³/min
  return depthOfCut * feedRate * wheelWidth;
};

// Estimate surface roughness based on parameters
export const estimateSurfaceRoughness = (
  grainSize: number,
  depthOfCut: number,
  feedRate: number
): number => {
  // Simplified formula for Ra estimation in μm
  const baseRa = 0.05 + (1000 / grainSize) * 0.01;
  const depthFactor = 1 + depthOfCut * 10;
  const feedFactor = 1 + feedRate * 0.2;
  return baseRa * depthFactor * feedFactor;
};
