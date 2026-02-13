export interface Material {
  id: string;
  name: string;
  category: string;
  hardness: string;
  cuttingSpeed: { min: number; max: number; unit: string };
  feedRate: { min: number; max: number; unit: string };
  taylorN: number;
  taylorC: number;
  color: string;
}

export const materials: Material[] = [
  {
    id: "steel-low",
    name: "Düşük Karbonlu Çelik",
    category: "Çelik",
    hardness: "120-180 HB",
    cuttingSpeed: { min: 100, max: 150, unit: "m/dk" },
    feedRate: { min: 0.1, max: 0.4, unit: "mm/dev" },
    taylorN: 0.25,
    taylorC: 520,
    color: "bg-blue-500",
  },
  {
    id: "steel-medium",
    name: "Orta Karbonlu Çelik",
    category: "Çelik",
    hardness: "180-250 HB",
    cuttingSpeed: { min: 100, max: 150, unit: "m/dk" },
    feedRate: { min: 0.08, max: 0.35, unit: "mm/dev" },
    taylorN: 0.22,
    taylorC: 400,
    color: "bg-blue-600",
  },
  {
    id: "steel-high",
    name: "Yüksek Karbonlu Çelik",
    category: "Çelik",
    hardness: "250-350 HB",
    cuttingSpeed: { min: 100, max: 150, unit: "m/dk" },
    feedRate: { min: 0.05, max: 0.25, unit: "mm/dev" },
    taylorN: 0.18,
    taylorC: 280,
    color: "bg-blue-700",
  },
  {
    id: "stainless",
    name: "Paslanmaz Çelik",
    category: "Çelik",
    hardness: "150-300 HB",
    cuttingSpeed: { min: 100, max: 150, unit: "m/dk" },
    feedRate: { min: 0.05, max: 0.2, unit: "mm/dev" },
    taylorN: 0.15,
    taylorC: 155,
    color: "bg-slate-400",
  },
  {
    id: "aluminum",
    name: "Alüminyum Alaşımı",
    category: "Hafif Metal",
    hardness: "60-120 HB",
    cuttingSpeed: { min: 300, max: 1000, unit: "m/dk" },
    feedRate: { min: 0.15, max: 0.6, unit: "mm/dev" },
    taylorN: 0.35,
    taylorC: 2800,
    color: "bg-gray-300",
  },
  {
    id: "brass",
    name: "Pirinç",
    category: "Bakır Alaşımı",
    hardness: "80-150 HB",
    cuttingSpeed: { min: 200, max: 400, unit: "m/dk" },
    feedRate: { min: 0.1, max: 0.5, unit: "mm/dev" },
    taylorN: 0.30,
    taylorC: 980,
    color: "bg-yellow-500",
  },
  {
    id: "bronze",
    name: "Bronz",
    category: "Bakır Alaşımı",
    hardness: "100-200 HB",
    cuttingSpeed: { min: 150, max: 300, unit: "m/dk" },
    feedRate: { min: 0.08, max: 0.4, unit: "mm/dev" },
    taylorN: 0.28,
    taylorC: 680,
    color: "bg-orange-700",
  },
  {
    id: "cast-iron",
    name: "Dökme Demir",
    category: "Demir",
    hardness: "150-300 HB",
    cuttingSpeed: { min: 80, max: 180, unit: "m/dk" },
    feedRate: { min: 0.1, max: 0.4, unit: "mm/dev" },
    taylorN: 0.20,
    taylorC: 320,
    color: "bg-gray-600",
  },
  {
    id: "titanium",
    name: "Titanyum Alaşımı",
    category: "Özel Metal",
    hardness: "300-400 HB",
    cuttingSpeed: { min: 30, max: 80, unit: "m/dk" },
    feedRate: { min: 0.05, max: 0.15, unit: "mm/dev" },
    taylorN: 0.12,
    taylorC: 86,
    color: "bg-purple-500",
  },
  {
    id: "inconel",
    name: "Inconel",
    category: "Süper Alaşım",
    hardness: "350-450 HB",
    cuttingSpeed: { min: 15, max: 40, unit: "m/dk" },
    feedRate: { min: 0.03, max: 0.1, unit: "mm/dev" },
    taylorN: 0.10,
    taylorC: 42,
    color: "bg-indigo-600",
  },
];

export const toolTypes = [
  { id: "hss", name: "HSS (Yüksek Hız Çeliği)", multiplier: 0.6 },
  { id: "carbide", name: "Karbür", multiplier: 1.0 },
  { id: "coated-carbide", name: "Kaplamalı Karbür", multiplier: 1.3 },
  { id: "ceramic", name: "Seramik", multiplier: 1.8 },
  { id: "cbn", name: "CBN", multiplier: 2.5 },
  { id: "pcd", name: "PCD (Elmas)", multiplier: 3.0 },
];

export const operations = [
  { id: "turning", name: "Tornalama", icon: "🔄" },
  { id: "milling", name: "Frezeleme", icon: "⚙️" },
  { id: "drilling", name: "Delme", icon: "🕳️" },
  { id: "boring", name: "Raybalama", icon: "⭕" },
];
