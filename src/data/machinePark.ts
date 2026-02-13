export interface Machine {
  id: string;
  code: string;
  type: "turning" | "milling-4axis" | "milling-5axis";
  designation: string;
  brand: string;
  model: string;
  year: number;
  label: string; // short display label
}

export const machinePark: Machine[] = [
  {
    id: "t302",
    code: "T302",
    type: "turning",
    designation: "CNC Torna",
    brand: "HYUNDAI KIA",
    model: "SKT 250 FOI TD",
    year: 2010,
    label: "T302 - Hyundai SKT 250",
  },
  {
    id: "t108",
    code: "T108",
    type: "turning",
    designation: "CNC Torna",
    brand: "HYUNDAI WIA",
    model: "L 300LC",
    year: 2017,
    label: "T108 - Hyundai L300LC",
  },
  {
    id: "t106",
    code: "T106",
    type: "turning",
    designation: "CNC Torna",
    brand: "HYUNDAI WIA",
    model: "L 300LC",
    year: 2019,
    label: "T106 - Hyundai L300LC",
  },
  {
    id: "t100",
    code: "T100",
    type: "turning",
    designation: "CNC Torna",
    brand: "HYUNDAI KIA",
    model: "SKT 21 FOI-TC",
    year: 2009,
    label: "T100 - Hyundai SKT 21",
  },
  {
    id: "t109",
    code: "T109",
    type: "turning",
    designation: "CNC Torna",
    brand: "DMG MORI",
    model: "CLX 450",
    year: 2019,
    label: "T109 - DMG CLX 450",
  },
  {
    id: "t200",
    code: "T200",
    type: "turning",
    designation: "CNC Torna",
    brand: "DMG MORI SEIKI",
    model: "CTX 310 ECOLINE",
    year: 2013,
    label: "T200 - DMG CTX 310",
  },
  {
    id: "t121",
    code: "T121",
    type: "milling-4axis",
    designation: "4 Eksen CNC Freze",
    brand: "OKUMA",
    model: "GENOS M560R-V",
    year: 2016,
    label: "T121 - Okuma M560R-V",
  },
  {
    id: "t122",
    code: "T122",
    type: "milling-4axis",
    designation: "4 Eksen CNC Freze",
    brand: "OKUMA",
    model: "GENOS M560R-V",
    year: 2017,
    label: "T122 - Okuma M560R-V",
  },
  {
    id: "t125",
    code: "T125",
    type: "milling-4axis",
    designation: "4 Eksen CNC Freze",
    brand: "OKUMA",
    model: "GENOS M560R-V",
    year: 2018,
    label: "T125 - Okuma M560R-V",
  },
  {
    id: "t137",
    code: "T137",
    type: "milling-5axis",
    designation: "3+2 / 5 Eksen CNC Freze",
    brand: "DECKEL MAHO",
    model: "DMU 50U",
    year: 2019,
    label: "T137 - DMU 50U (5 Eksen)",
  },
  {
    id: "t138",
    code: "T138",
    type: "milling-5axis",
    designation: "3+2 / 5 Eksen CNC Freze",
    brand: "DECKEL MAHO",
    model: "DMU 70U",
    year: 2019,
    label: "T138 - DMU 70U (5 Eksen)",
  },
];

export const getMachinesByType = (type: Machine["type"]) =>
  machinePark.filter((m) => m.type === type);

export const getMachineLabel = (id: string) =>
  machinePark.find((m) => m.id === id)?.label ?? id;
