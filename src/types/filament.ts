export type MaterialType = 'PLA' | 'PETG' | 'ABS' | 'ASA' | 'RESINA';

export type MixingPhysicsMode = 'kubelka-munk' | 'spectral-linear';

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface FilamentSpool {
  id: string;
  name: string;
  brand: string;
  material: string;
  hex: string;
  /** Relative pigment tinting strength / opacity factor (0.2 = translucent, 1.0 = standard, 1.5 = high-opacity titanium/carbon) */
  tintStrength: number;
  active: boolean;
}

export interface SpoolmanFilamentItem {
  id: string;
  manufacturer: string;
  name: string;
  material: string;
  hex: string;
  density: number | null;
  finish: string | null;
  translucent: boolean;
  estimatedTintStrength: number;
}

export interface FilamentWithSpectrum extends FilamentSpool {
  spectrum: number[]; // 31 bands: 400nm - 700nm (10nm step)
  ks: number[]; // Kubelka-Munk K/S per band
  lab: LabColor;
  rgb: RgbColor;
}

export interface MixComponentResult {
  filament: FilamentWithSpectrum;
  /** Fraction 0..1 */
  ratio: number;
  /** Percentage 0..100 */
  percentage: number;
  /** Weight in grams for current batch */
  grams: number;
  /** Length in meters for 1.75mm filament diameter */
  meters: number;
}

export interface MixSolution {
  id: string;
  label: string;
  maxColors: number;
  components: MixComponentResult[];
  predictedHex: string;
  predictedRgb: RgbColor;
  predictedLab: LabColor;
  predictedSpectrum: number[];
  deltaE2000: number;
  deltaE76: number;
  spectralRmse: number;
}

export interface MixAnalysisResult {
  targetHex: string;
  targetRgb: RgbColor;
  targetLab: LabColor;
  targetSpectrum: number[];
  solutions: MixSolution[];
  recommendedIndex: number;
  outOfGamutAdvice: string | null;
}

export interface TargetPreset {
  name: string;
  hex: string;
  category: string;
}

export interface FilamentKitPreset {
  id: string;
  name: string;
  description: string;
  filaments: Omit<FilamentSpool, 'id'>[];
}

export interface MixHistoryEntry {
  id: string;
  signature: string;
  timestamp: number;
  targetHex: string;
  predictedHex: string;
  deltaE2000: number;
  spectralRmse: number;
  physicsMode: MixingPhysicsMode;
  maxColors: number;
  minPercentage: number;
  material: MaterialType;
  components: {
    name: string;
    hex: string;
    percentage: number;
  }[];
}
