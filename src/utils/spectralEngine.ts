import {
  FilamentSpool,
  FilamentWithSpectrum,
  LabColor,
  MixAnalysisResult,
  MixComponentResult,
  MixingPhysicsMode,
  MixSolution,
  MaterialType,
  RgbColor,
} from '../types/filament';

/**
 * 31 wavelength bands across visible spectrum: 400nm to 700nm (10nm step)
 */
export const WAVELENGTHS: number[] = Array.from({ length: 31 }, (_, i) => 400 + i * 10);

export const MATERIAL_DENSITIES: Record<MaterialType, number> = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.07,
  RESINA: 1.12,
};

// CIE 1931 2-degree Standard Observer CMFs (400nm - 700nm, 10nm step)
const CIE_X_BAR = [
  0.0143, 0.0435, 0.1344, 0.2839, 0.3483, 0.3362, 0.2908, 0.1954, 0.0956, 0.0320,
  0.0049, 0.0093, 0.0633, 0.1655, 0.2904, 0.4334, 0.5945, 0.7621, 0.9163, 1.0263,
  1.0622, 1.0026, 0.8544, 0.6424, 0.4479, 0.2835, 0.1649, 0.0874, 0.0468, 0.0227,
  0.0114,
];

const CIE_Y_BAR = [
  0.0004, 0.0012, 0.0040, 0.0116, 0.0230, 0.0380, 0.0600, 0.0910, 0.1390, 0.2080,
  0.3230, 0.5030, 0.7100, 0.8620, 0.9540, 0.9950, 0.9950, 0.9520, 0.8700, 0.7570,
  0.6310, 0.5030, 0.3810, 0.2650, 0.1750, 0.1070, 0.0610, 0.0320, 0.0170, 0.0082,
  0.0041,
];

const CIE_Z_BAR = [
  0.0679, 0.2074, 0.6456, 1.3856, 1.7471, 1.7721, 1.6692, 1.2876, 0.8130, 0.4652,
  0.2720, 0.1582, 0.0782, 0.0422, 0.0203, 0.0087, 0.0039, 0.0021, 0.0017, 0.0011,
  0.0008, 0.0003, 0.0002, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000, 0.0000,
  0.0000,
];

// CIE Standard Illuminant D65 relative spectral power distribution (400nm - 700nm, 10nm step)
const D65_SPD = [
  82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81,
  109.35, 107.80, 104.79, 107.69, 104.41, 104.05, 100.00, 96.33, 95.79, 88.69,
  90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28, 78.28, 69.72,
  71.61,
];

// Standard D65 white point
const D65_WHITE_X = 0.95047;
const D65_WHITE_Y = 1.00000;
const D65_WHITE_Z = 1.08883;

// Precompute normalized spectral integration weights W[31][3] such that R=[1...1] -> exact D65 white point
const { W_X, W_Y, W_Z } = (() => {
  const rawX = WAVELENGTHS.map((_, i) => D65_SPD[i] * CIE_X_BAR[i]);
  const rawY = WAVELENGTHS.map((_, i) => D65_SPD[i] * CIE_Y_BAR[i]);
  const rawZ = WAVELENGTHS.map((_, i) => D65_SPD[i] * CIE_Z_BAR[i]);

  const sumX = rawX.reduce((a, b) => a + b, 0);
  const sumY = rawY.reduce((a, b) => a + b, 0);
  const sumZ = rawZ.reduce((a, b) => a + b, 0);

  return {
    W_X: rawX.map((v) => (v / sumX) * D65_WHITE_X),
    W_Y: rawY.map((v) => (v / sumY) * D65_WHITE_Y),
    W_Z: rawZ.map((v) => (v / sumZ) * D65_WHITE_Z),
  };
})();

// Precompute inverse smoothness matrix M^-1 for 31 bands (Least-Slope-Squared spectral upsampling)
const R_MIN = 0.006;
const R_MAX = 0.992;
const R_SPAN = R_MAX - R_MIN;

const M_INV: number[][] = (() => {
  const n = 31;
  // M = D1^T * D1 + eps * I, where D1 is first-difference operator
  const M: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    M[i][i] += 1e-4;
    if (i < n - 1) {
      M[i][i] += 1;
      M[i + 1][i + 1] += 1;
      M[i][i + 1] -= 1;
      M[i + 1][i] -= 1;
    }
  }
  return invertMatrix(M);
})();

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }
    const tmp = aug[i];
    aug[i] = aug[maxRow];
    aug[maxRow] = tmp;

    const pivot = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = aug[k][i];
        for (let j = 0; j < 2 * n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
  }
  return aug.map((row) => row.slice(n));
}

function solve3x3(A: number[][], b: number[]): number[] {
  const m = [
    [A[0][0], A[0][1], A[0][2], b[0]],
    [A[1][0], A[1][1], A[1][2], b[1]],
    [A[2][0], A[2][1], A[2][2], b[2]],
  ];

  for (let i = 0; i < 3; i++) {
    let maxRow = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k;
    }
    const tmp = m[i];
    m[i] = m[maxRow];
    m[maxRow] = tmp;

    const pivot = Math.abs(m[i][i]) < 1e-12 ? 1e-12 : m[i][i];
    for (let j = i; j < 4; j++) m[i][j] /= pivot;
    for (let k = 0; k < 3; k++) {
      if (k !== i) {
        const f = m[k][i];
        for (let j = i; j < 4; j++) m[k][j] -= f * m[i][j];
      }
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

// ============================================================================
// Color Space Conversions (sRGB <-> Linear RGB <-> XYZ <-> CIELAB <-> Hex)
// ============================================================================

export function normalizeHex(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toUpperCase();
  }
  return '#3B82F6';
}

export function hexToRgb(hex: string): RgbColor {
  const norm = normalizeHex(hex);
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clampByte(r), clampByte(g), clampByte(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  const v = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

export function rgbToXyz(rgb: RgbColor): [number, number, number] {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const Z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  return [X, Y, Z];
}

export function xyzToRgb(X: number, Y: number, Z: number): RgbColor {
  const rLin = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const gLin = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const bLin = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;

  return {
    r: linearToSrgb(rLin),
    g: linearToSrgb(gLin),
    b: linearToSrgb(bLin),
  };
}

export function xyzToLab(X: number, Y: number, Z: number): LabColor {
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X / D65_WHITE_X);
  const fy = f(Y / D65_WHITE_Y);
  const fz = f(Z / D65_WHITE_Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function labToXyz(lab: LabColor): [number, number, number] {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;

  const invF = (t: number) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);

  return [
    D65_WHITE_X * invF(fx),
    D65_WHITE_Y * invF(fy),
    D65_WHITE_Z * invF(fz),
  ];
}

export function hexToLab(hex: string): LabColor {
  const [X, Y, Z] = rgbToXyz(hexToRgb(hex));
  return xyzToLab(X, Y, Z);
}

export function labToHex(lab: LabColor): string {
  const [X, Y, Z] = labToXyz(lab);
  return rgbToHex(xyzToRgb(X, Y, Z));
}

export function spectrumToXyz(spectrum: number[]): [number, number, number] {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let i = 0; i < 31; i++) {
    const r = spectrum[i];
    X += W_X[i] * r;
    Y += W_Y[i] * r;
    Z += W_Z[i] * r;
  }
  return [X, Y, Z];
}

export function spectrumToLab(spectrum: number[]): LabColor {
  const [X, Y, Z] = spectrumToXyz(spectrum);
  return xyzToLab(X, Y, Z);
}

export function spectrumToRgb(spectrum: number[]): RgbColor {
  const [X, Y, Z] = spectrumToXyz(spectrum);
  return xyzToRgb(X, Y, Z);
}

/**
 * CIEDE2000 perceptual color difference (ΔE00)
 */
export function deltaE2000(lab1: LabColor, lab2: LabColor): number {
  const kL = 1.0;
  const kC = 1.0;
  const kH = 1.0;

  const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
  const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1Prime = (1 + G) * lab1.a;
  const a2Prime = (1 + G) * lab2.a;

  const C1Prime = Math.sqrt(a1Prime * a1Prime + lab1.b * lab1.b);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + lab2.b * lab2.b);

  const deg = (rad: number) => (rad * 180) / Math.PI;
  const rad = (d: number) => (d * Math.PI) / 180;

  const atan2Deg = (y: number, x: number) => {
    if (x === 0 && y === 0) return 0;
    const angle = deg(Math.atan2(y, x));
    return angle >= 0 ? angle : angle + 360;
  };

  const h1Prime = atan2Deg(lab1.b, a1Prime);
  const h2Prime = atan2Deg(lab2.b, a2Prime);

  const dLPrime = lab2.L - lab1.L;
  const dCPrime = C2Prime - C1Prime;

  let dhPrime = 0;
  if (C1Prime * C2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) dhPrime = diff;
    else if (diff > 180) dhPrime = diff - 360;
    else dhPrime = diff + 360;
  }

  const dHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(rad(dhPrime / 2));

  const LbarPrime = (lab1.L + lab2.L) / 2;
  const CbarPrime = (C1Prime + C2Prime) / 2;

  let hbarPrime = h1Prime + h2Prime;
  if (C1Prime * C2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) <= 180) hbarPrime = (h1Prime + h2Prime) / 2;
    else if (h1Prime + h2Prime < 360) hbarPrime = (h1Prime + h2Prime + 360) / 2;
    else hbarPrime = (h1Prime + h2Prime - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hbarPrime - 30)) +
    0.24 * Math.cos(rad(2 * hbarPrime)) +
    0.32 * Math.cos(rad(3 * hbarPrime + 6)) -
    0.20 * Math.cos(rad(4 * hbarPrime - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hbarPrime - 275) / 25, 2));
  const CbarPrime7 = Math.pow(CbarPrime, 7);
  const RC = 2 * Math.sqrt(CbarPrime7 / (CbarPrime7 + Math.pow(25, 7)));

  const L50sq = Math.pow(LbarPrime - 50, 2);
  const SL = 1 + (0.015 * L50sq) / Math.sqrt(20 + L50sq);
  const SC = 1 + 0.045 * CbarPrime;
  const SH = 1 + 0.015 * CbarPrime * T;
  const RT = -Math.sin(rad(2 * dTheta)) * RC;

  const termL = dLPrime / (kL * SL);
  const termC = dCPrime / (kC * SC);
  const termH = dHPrime / (kH * SH);

  return Math.sqrt(
    termL * termL + termC * termC + termH * termH + RT * termC * termH
  );
}

export function deltaE76(lab1: LabColor, lab2: LabColor): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// ============================================================================
// Spectral Reflectance Upsampling (Iterative Least-Slope Squared)
// ============================================================================

const spectrumCache = new Map<string, number[]>();

export function hexToSpectrum(hex: string): number[] {
  const norm = normalizeHex(hex);
  const cached = spectrumCache.get(norm);
  if (cached) return cached;

  const rgb = hexToRgb(norm);
  const [Xt, Yt, Zt] = rgbToXyz(rgb);

  // Clamp XYZ gently into physically realizable filament reflectance envelope [R_MIN, R_MAX]
  const minX = R_MIN * D65_WHITE_X;
  const minY = R_MIN * D65_WHITE_Y;
  const minZ = R_MIN * D65_WHITE_Z;
  const maxX = R_MAX * D65_WHITE_X;
  const maxY = R_MAX * D65_WHITE_Y;
  const maxZ = R_MAX * D65_WHITE_Z;

  // Clamp XYZ only at extreme black/white bounds so midtones preserve exact colorimetric fidelity
  const targetX = Math.max(minX, Math.min(maxX, Xt));
  const targetY = Math.max(minY, Math.min(maxY, Yt));
  const targetZ = Math.max(minZ, Math.min(maxZ, Zt));

  let z = Array(31).fill(0);

  for (let iter = 0; iter < 18; iter++) {
    const R = new Array<number>(31);
    const d = new Array<number>(31);

    for (let i = 0; i < 31; i++) {
      const clampedZ = Math.max(-14, Math.min(14, z[i]));
      const sig = 1 / (1 + Math.exp(-clampedZ));
      R[i] = R_MIN + R_SPAN * sig;
      d[i] = R_SPAN * sig * (1 - sig);
    }

    const [X, Y, Z] = spectrumToXyz(R);
    const f = [X - targetX, Y - targetY, Z - targetZ];
    const err = Math.hypot(f[0], f[1], f[2]);
    if (err < 1e-6 && iter > 2) break;

    // J[3][31] where J[k][i] = W_k[i] * d[i]
    // Jz = J * z
    const Jz = [0, 0, 0];
    // K = M_INV * J^T (31 x 3)
    const K0 = new Array<number>(31).fill(0);
    const K1 = new Array<number>(31).fill(0);
    const K2 = new Array<number>(31).fill(0);

    for (let i = 0; i < 31; i++) {
      const j0 = W_X[i] * d[i];
      const j1 = W_Y[i] * d[i];
      const j2 = W_Z[i] * d[i];
      Jz[0] += j0 * z[i];
      Jz[1] += j1 * z[i];
      Jz[2] += j2 * z[i];

      for (let r = 0; r < 31; r++) {
        const m = M_INV[r][i];
        K0[r] += m * j0;
        K1[r] += m * j1;
        K2[r] += m * j2;
      }
    }

    // A = J * M_INV * J^T (3 x 3) + Tikhonov damping
    const A = [
      [1e-8, 0, 0],
      [0, 1e-8, 0],
      [0, 0, 1e-8],
    ];
    for (let i = 0; i < 31; i++) {
      const j0 = W_X[i] * d[i];
      const j1 = W_Y[i] * d[i];
      const j2 = W_Z[i] * d[i];

      A[0][0] += j0 * K0[i];
      A[0][1] += j0 * K1[i];
      A[0][2] += j0 * K2[i];

      A[1][0] += j1 * K0[i];
      A[1][1] += j1 * K1[i];
      A[1][2] += j1 * K2[i];

      A[2][0] += j2 * K0[i];
      A[2][1] += j2 * K1[i];
      A[2][2] += j2 * K2[i];
    }

    const rhs = [f[0] - Jz[0], f[1] - Jz[1], f[2] - Jz[2]];
    const mu = solve3x3(A, rhs);

    const zNext = new Array<number>(31);
    for (let i = 0; i < 31; i++) {
      const raw = -(K0[i] * mu[0] + K1[i] * mu[1] + K2[i] * mu[2]);
      // Damped update for stability on highly saturated primaries
      zNext[i] = 0.35 * z[i] + 0.65 * Math.max(-12, Math.min(12, raw));
    }
    z = zNext;
  }

  const finalSpectrum = z.map((zi) => {
    const sig = 1 / (1 + Math.exp(-Math.max(-14, Math.min(14, zi))));
    return R_MIN + R_SPAN * sig;
  });

  spectrumCache.set(norm, finalSpectrum);
  return finalSpectrum;
}

// ============================================================================
// Kubelka-Munk Mixing Physics
// ============================================================================

export function reflectanceToKS(R: number): number {
  const r = Math.max(0.002, Math.min(0.998, R));
  return ((1 - r) * (1 - r)) / (2 * r);
}

export function ksToReflectance(ks: number): number {
  const k = Math.max(0, ks);
  return 1 + k - Math.sqrt(k * k + 2 * k);
}

export function enrichFilament(spool: FilamentSpool): FilamentWithSpectrum {
  const normHex = normalizeHex(spool.hex);
  const spectrum = hexToSpectrum(normHex);
  const ks = spectrum.map(reflectanceToKS);
  const rgb = hexToRgb(normHex);
  const lab = spectrumToLab(spectrum);
  return {
    ...spool,
    hex: normHex,
    spectrum,
    ks,
    rgb,
    lab,
  };
}

export function mixSpectra(
  filaments: FilamentWithSpectrum[],
  ratios: number[],
  mode: MixingPhysicsMode
): number[] {
  const out = new Array<number>(31).fill(0);

  if (mode === 'spectral-linear') {
    for (let b = 0; b < 31; b++) {
      let sum = 0;
      for (let i = 0; i < filaments.length; i++) {
        sum += ratios[i] * filaments[i].spectrum[b];
      }
      out[b] = sum;
    }
    return out;
  }

  // Kubelka-Munk absorptive-scattering polymer mixing weighted by tint strength
  let totalWeight = 0;
  for (let i = 0; i < filaments.length; i++) {
    totalWeight += ratios[i] * filaments[i].tintStrength;
  }
  const norm = totalWeight > 1e-9 ? totalWeight : 1;

  for (let b = 0; b < 31; b++) {
    let ksMix = 0;
    for (let i = 0; i < filaments.length; i++) {
      const w = (ratios[i] * filaments[i].tintStrength) / norm;
      ksMix += w * filaments[i].ks[b];
    }
    out[b] = ksToReflectance(ksMix);
  }
  return out;
}

// ============================================================================
// Simplex Optimization Solver (Finding Exact Filament Mix Ratios)
// ============================================================================

function projectOntoSimplex(v: number[]): number[] {
  const n = v.length;
  const u = [...v].sort((a, b) => b - a);
  let cssv = 0;
  let rho = -1;
  for (let i = 0; i < n; i++) {
    cssv += u[i];
    const t = (cssv - 1) / (i + 1);
    if (u[i] - t > 0) rho = i;
  }
  const theta =
    rho >= 0
      ? (u.slice(0, rho + 1).reduce((a, b) => a + b, 0) - 1) / (rho + 1)
      : 0;
  return v.map((val) => Math.max(0, val - theta));
}

function projectOntoBoundedSimplex(v: number[], minRatio: number): number[] {
  const n = v.length;
  if (minRatio <= 0) return projectOntoSimplex(v);
  const m = Math.min(minRatio, 1 / n);
  const freeMass = 1 - n * m;
  if (freeMass <= 1e-9) {
    return Array(n).fill(1 / n);
  }
  const shifted = v.map((val) => (val - m) / freeMass);
  const projected = projectOntoSimplex(shifted);
  return projected.map((p) => m + freeMass * p);
}

function evaluateSubsetLoss(
  subset: FilamentWithSpectrum[],
  ratios: number[],
  targetLab: LabColor,
  targetSpectrum: number[],
  mode: MixingPhysicsMode
): { loss: number; de: number; rmse: number; spectrum: number[]; lab: LabColor } {
  const spectrum = mixSpectra(subset, ratios, mode);
  const lab = spectrumToLab(spectrum);
  const de = deltaE2000(lab, targetLab);

  let sqErr = 0;
  for (let i = 0; i < 31; i++) {
    const d = spectrum[i] - targetSpectrum[i];
    sqErr += d * d;
  }
  const rmse = Math.sqrt(sqErr / 31);
  // Primary perceptual metric ΔE2000 + minor spectral tie-breaker for metamerism resistance
  const loss = de + 4.0 * rmse;
  return { loss, de, rmse, spectrum, lab };
}

function optimizeSubset(
  subset: FilamentWithSpectrum[],
  targetLab: LabColor,
  targetSpectrum: number[],
  mode: MixingPhysicsMode,
  minRatio: number
): { ratios: number[]; loss: number; de: number; rmse: number; spectrum: number[]; lab: LabColor } {
  const k = subset.length;
  if (k === 1) {
    const res = evaluateSubsetLoss(subset, [1], targetLab, targetSpectrum, mode);
    return { ratios: [1], ...res };
  }

  const m = Math.min(Math.max(0, minRatio), 1 / k);

  // Exact fast 1D grid + golden section refinement for 2 colors within [m, 1 - m]
  if (k === 2) {
    const minT = m;
    const maxT = 1 - m;
    let bestT = 0.5;
    let bestLoss = Infinity;
    for (let s = 0; s <= 40; s++) {
      const t = minT + (s / 40) * (maxT - minT);
      const { loss } = evaluateSubsetLoss(subset, [t, 1 - t], targetLab, targetSpectrum, mode);
      if (loss < bestLoss) {
        bestLoss = loss;
        bestT = t;
      }
    }
    let lo = Math.max(minT, bestT - 0.03);
    let hi = Math.min(maxT, bestT + 0.03);
    const phi = (Math.sqrt(5) - 1) / 2;
    let x1 = hi - phi * (hi - lo);
    let x2 = lo + phi * (hi - lo);
    let f1 = evaluateSubsetLoss(subset, [x1, 1 - x1], targetLab, targetSpectrum, mode).loss;
    let f2 = evaluateSubsetLoss(subset, [x2, 1 - x2], targetLab, targetSpectrum, mode).loss;
    for (let iter = 0; iter < 18; iter++) {
      if (f1 < f2) {
        hi = x2;
        x2 = x1;
        f2 = f1;
        x1 = hi - phi * (hi - lo);
        f1 = evaluateSubsetLoss(subset, [x1, 1 - x1], targetLab, targetSpectrum, mode).loss;
      } else {
        lo = x1;
        x1 = x2;
        f1 = f2;
        x2 = lo + phi * (hi - lo);
        f2 = evaluateSubsetLoss(subset, [x2, 1 - x2], targetLab, targetSpectrum, mode).loss;
      }
    }
    const optT = Math.max(minT, Math.min(maxT, (lo + hi) / 2));
    const ratios = [optT, 1 - optT];
    return { ratios, ...evaluateSubsetLoss(subset, ratios, targetLab, targetSpectrum, mode) };
  }

  // Multi-start Bounded Simplex Coordinate & Pairwise Transfer Pattern Search for k >= 3
  const starts: number[][] = [
    Array(k).fill(1 / k),
    (() => {
      let bestI = 0;
      let bestDe = Infinity;
      subset.forEach((f, idx) => {
        const d = deltaE2000(f.lab, targetLab);
        if (d < bestDe) {
          bestDe = d;
          bestI = idx;
        }
      });
      const tailShare = Math.max(m, (1 - 0.7) / (k - 1));
      const headShare = Math.max(m, 1 - tailShare * (k - 1));
      return subset.map((_, idx) => (idx === bestI ? headShare : tailShare));
    })(),
  ];

  let bestGlobalRatios = starts[0];
  let bestGlobalEval = evaluateSubsetLoss(subset, bestGlobalRatios, targetLab, targetSpectrum, mode);

  for (const init of starts) {
    let x = projectOntoBoundedSimplex(init, m);
    let current = evaluateSubsetLoss(subset, x, targetLab, targetSpectrum, mode);

    // Pairwise mass transfer pattern search strictly respecting x[j] >= m
    const steps = [0.25, 0.12, 0.05, 0.02, 0.008, 0.002];
    for (const step of steps) {
      let improved = true;
      let guard = 0;
      while (improved && guard < 18) {
        improved = false;
        guard++;
        for (let i = 0; i < k; i++) {
          for (let j = 0; j < k; j++) {
            if (i === j) continue;
            const available = x[j] - m;
            if (available <= 1e-6) continue;
            const delta = Math.min(step, available);
            const candidate = [...x];
            candidate[i] += delta;
            candidate[j] -= delta;
            const ev = evaluateSubsetLoss(subset, candidate, targetLab, targetSpectrum, mode);
            if (ev.loss < current.loss - 1e-6) {
              x = candidate;
              current = ev;
              improved = true;
            }
          }
        }
      }
    }

    // Fine projected gradient polish within bounded simplex [m, 1 - (k-1)m]
    let lr = 0.015;
    for (let iter = 0; iter < 15; iter++) {
      const eps = 1e-4;
      const grad = new Array<number>(k).fill(0);
      for (let i = 0; i < k; i++) {
        const xp = [...x];
        xp[i] += eps;
        const fp = evaluateSubsetLoss(
          subset,
          projectOntoBoundedSimplex(xp, m),
          targetLab,
          targetSpectrum,
          mode
        ).loss;
        grad[i] = (fp - current.loss) / eps;
      }
      const next = projectOntoBoundedSimplex(
        x.map((xi, i) => xi - lr * grad[i]),
        m
      );
      const ev = evaluateSubsetLoss(subset, next, targetLab, targetSpectrum, mode);
      if (ev.loss < current.loss) {
        x = next;
        current = ev;
      } else {
        lr *= 0.5;
      }
    }

    if (current.loss < bestGlobalEval.loss) {
      bestGlobalEval = current;
      bestGlobalRatios = x;
    }
  }

  return { ratios: bestGlobalRatios, ...bestGlobalEval };
}

function buildSolution(
  id: string,
  label: string,
  maxColors: number,
  subset: FilamentWithSpectrum[],
  opt: ReturnType<typeof optimizeSubset>,
  targetLab: LabColor,
  batchGrams: number,
  density: number,
  mode: MixingPhysicsMode,
  minRatio: number
): MixSolution {
  // When minRatio === 0, prune negligible trace (< 0.3%). When minRatio > 0, all subset items are >= minRatio.
  const pruneThreshold = minRatio > 0 ? 0 : 0.003;
  const paired = subset
    .map((f, i) => ({ filament: f, ratio: opt.ratios[i] }))
    .filter((item) => item.ratio >= pruneThreshold)
    .sort((a, b) => b.ratio - a.ratio);

  const totalRatio = paired.reduce((s, p) => s + p.ratio, 0) || 1;
  const normalized = paired.map((p) => ({
    filament: p.filament,
    ratio: p.ratio / totalRatio,
  }));

  const finalSpectrum = mixSpectra(
    normalized.map((n) => n.filament),
    normalized.map((n) => n.ratio),
    mode
  );
  const finalLab = spectrumToLab(finalSpectrum);
  const finalRgb = spectrumToRgb(finalSpectrum);
  const finalHex = rgbToHex(finalRgb);
  const de2000 = deltaE2000(finalLab, targetLab);
  const de76 = deltaE76(finalLab, targetLab);

  // Cross-sectional area of 1.75mm filament = pi * (0.0875 cm)^2 = 0.0240528 cm^2
  const areaCm2 = Math.PI * 0.0875 * 0.0875;
  const gramsPerMeter = density * areaCm2 * 100;

  const components: MixComponentResult[] = normalized.map((n) => {
    const percentage = n.ratio * 100;
    const grams = n.ratio * batchGrams;
    const meters = grams / gramsPerMeter;
    return {
      filament: n.filament,
      ratio: n.ratio,
      percentage,
      grams,
      meters,
    };
  });

  return {
    id,
    label,
    maxColors,
    components,
    predictedHex: finalHex,
    predictedRgb: finalRgb,
    predictedLab: finalLab,
    predictedSpectrum: finalSpectrum,
    deltaE2000: de2000,
    deltaE76: de76,
    spectralRmse: opt.rmse,
  };
}

function generateCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, curr: T[]) {
    if (curr.length === k) {
      result.push([...curr]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      curr.push(arr[i]);
      backtrack(i + 1, curr);
      curr.pop();
    }
  }
  backtrack(0, []);
  return result;
}

function findBestSubsetForK(
  pool: FilamentWithSpectrum[],
  k: number,
  targetLab: LabColor,
  targetSpectrum: number[],
  mode: MixingPhysicsMode,
  minRatio: number
): { subset: FilamentWithSpectrum[]; opt: ReturnType<typeof optimizeSubset> } | null {
  if (pool.length === 0) return null;
  const effectiveK = Math.min(k, pool.length);

  if (effectiveK === 1) {
    let bestF = pool[0];
    let bestOpt = optimizeSubset([bestF], targetLab, targetSpectrum, mode, minRatio);
    for (let i = 1; i < pool.length; i++) {
      const opt = optimizeSubset([pool[i]], targetLab, targetSpectrum, mode, minRatio);
      if (opt.loss < bestOpt.loss) {
        bestOpt = opt;
        bestF = pool[i];
      }
    }
    return { subset: [bestF], opt: bestOpt };
  }

  // If combinatorial count is small (e.g. <= 180 combinations), search exhaustively!
  const combosCount = (() => {
    let num = 1;
    let den = 1;
    for (let i = 0; i < effectiveK; i++) {
      num *= pool.length - i;
      den *= i + 1;
    }
    return num / den;
  })();

  if (combosCount <= 180 && effectiveK <= 4) {
    const combos = generateCombinations(pool, effectiveK);
    let bestSubset = combos[0];
    let bestOpt = optimizeSubset(bestSubset, targetLab, targetSpectrum, mode, minRatio);
    for (let i = 1; i < combos.length; i++) {
      const opt = optimizeSubset(combos[i], targetLab, targetSpectrum, mode, minRatio);
      if (opt.loss < bestOpt.loss) {
        bestOpt = opt;
        bestSubset = combos[i];
      }
    }
    return { subset: bestSubset, opt: bestOpt };
  }

  // Otherwise: Run full-pool simplex optimization first to rank top candidates, then refine with greedy additions
  const fullOpt = optimizeSubset(pool, targetLab, targetSpectrum, mode, minRatio);
  if (effectiveK >= pool.length) {
    return { subset: pool, opt: fullOpt };
  }

  const ranked = pool
    .map((f, i) => ({ f, w: fullOpt.ratios[i] }))
    .sort((a, b) => b.w - a.w);

  const seedSubset = ranked.slice(0, effectiveK).map((r) => r.f);
  let bestSubset = seedSubset;
  let bestOpt = optimizeSubset(bestSubset, targetLab, targetSpectrum, mode, minRatio);

  // Also test greedy forward build from best 2-color pair
  const pairs = generateCombinations(pool, 2);
  const topPairs = pairs
    .map((pair) => ({ pair, opt: optimizeSubset(pair, targetLab, targetSpectrum, mode, minRatio) }))
    .sort((a, b) => a.opt.loss - b.opt.loss)
    .slice(0, 4);

  for (const tp of topPairs) {
    const currentSet = [...tp.pair];
    while (currentSet.length < effectiveK) {
      let bestCandidate: FilamentWithSpectrum | null = null;
      let bestCandidateOpt: ReturnType<typeof optimizeSubset> | null = null;
      for (const f of pool) {
        if (currentSet.some((s) => s.id === f.id)) continue;
        const opt = optimizeSubset([...currentSet, f], targetLab, targetSpectrum, mode, minRatio);
        if (!bestCandidateOpt || opt.loss < bestCandidateOpt.loss) {
          bestCandidateOpt = opt;
          bestCandidate = f;
        }
      }
      if (bestCandidate && bestCandidateOpt) {
        currentSet.push(bestCandidate);
        if (currentSet.length === effectiveK && bestCandidateOpt.loss < bestOpt.loss) {
          bestOpt = bestCandidateOpt;
          bestSubset = [...currentSet];
        }
      } else {
        break;
      }
    }
  }

  return { subset: bestSubset, opt: bestOpt };
}

function computeOutOfGamutAdvice(
  targetLab: LabColor,
  bestLab: LabColor,
  deltaE: number
): string | null {
  if (deltaE <= 3.2) return null;

  const dL = targetLab.L - bestLab.L;
  const da = targetLab.a - bestLab.a;
  const db = targetLab.b - bestLab.b;

  const hints: string[] = [];
  if (Math.abs(dL) > 10) {
    hints.push(dL > 0 ? 'un filamento blanco o tono más claro (mayor luminosidad L*)' : 'un filamento negro o más oscuro');
  }
  if (Math.hypot(da, db) > 12) {
    if (da > 10 && Math.abs(db) < 12) hints.push('rojo o magenta puro');
    else if (da < -10 && Math.abs(db) < 12) hints.push('verde o cian intenso');
    else if (db > 10 && Math.abs(da) < 12) hints.push('amarillo puro saturado');
    else if (db < -10 && Math.abs(da) < 12) hints.push('azul cobalto o azul primario');
    else if (da > 8 && db > 8) hints.push('naranja o rojo cálido');
    else if (da > 8 && db < -8) hints.push('magenta o violeta');
    else if (da < -8 && db > 8) hints.push('verde lima o verde amarillento');
    else if (da < -8 && db < -8) hints.push('cian o turquesa');
  }

  if (hints.length === 0) {
    return 'El tono objetivo excede ligeramente la saturación alcanzable con tus carretes activos. Considera añadir pigmentos primarios puros (CMYKW).';
  }
  return `El tono objetivo queda fuera de la gama actual de tus filamentos activos (ΔE ${deltaE.toFixed(1)}). Para alcanzarlo necesitarías incorporar ${hints.join(' y ')}.`;
}

export function calculateFilamentMix(
  targetHexInput: string,
  inventory: FilamentSpool[],
  options: {
    maxColors: number; // 2, 3, 4, or 0 for unlimited
    batchGrams: number;
    materialDensity: number;
    physicsMode: MixingPhysicsMode;
    minComponentRatio?: number; // e.g. 0.10 for 10% minimum per material
  }
): MixAnalysisResult {
  const targetHex = normalizeHex(targetHexInput);
  const targetRgb = hexToRgb(targetHex);
  const targetSpectrum = hexToSpectrum(targetHex);
  const targetLab = spectrumToLab(targetSpectrum);

  const minRatio = Math.max(0, Math.min(0.45, options.minComponentRatio ?? 0.10));
  const activePool = inventory.filter((f) => f.active).map(enrichFilament);

  if (activePool.length === 0) {
    return {
      targetHex,
      targetRgb,
      targetLab,
      targetSpectrum,
      solutions: [],
      recommendedIndex: 0,
      outOfGamutAdvice: 'Activa o añade al menos un filamento en el inventario para calcular la mezcla.',
    };
  }

  const maxFeasibleByMin = minRatio > 0 ? Math.floor(1 / minRatio + 1e-9) : 6;
  const candidateKs: number[] = [];
  const cap =
    options.maxColors === 0
      ? Math.min(6, activePool.length, maxFeasibleByMin)
      : Math.min(options.maxColors, activePool.length, maxFeasibleByMin);

  // Include 1-filament direct option when a minimum ratio constraint is active,
  // since forcing >=10% of a second color can occasionally be worse than 100% of one spool.
  if (minRatio > 0) candidateKs.push(1);
  if (activePool.length >= 2 && cap >= 2) candidateKs.push(2);
  if (activePool.length >= 3 && cap >= 3) candidateKs.push(3);
  if (activePool.length >= 4 && cap >= 4) candidateKs.push(4);
  if (options.maxColors === 0 && cap > 4) candidateKs.push(cap);
  if (candidateKs.length === 0) candidateKs.push(1);

  const solutions: MixSolution[] = [];

  for (const k of candidateKs) {
    const found = findBestSubsetForK(
      activePool,
      k,
      targetLab,
      targetSpectrum,
      options.physicsMode,
      minRatio
    );
    if (!found) continue;

    const label =
      k === 1
        ? '1 Filamento directo'
        : k <= 4
          ? `Fórmula ${k} colores`
          : `Óptima (${found.subset.length} máx.)`;

    const sol = buildSolution(
      `sol-${k}`,
      label,
      k,
      found.subset,
      found.opt,
      targetLab,
      options.batchGrams,
      options.materialDensity,
      options.physicsMode,
      minRatio
    );

    let sq = 0;
    for (let i = 0; i < 31; i++) {
      const diff = sol.predictedSpectrum[i] - targetSpectrum[i];
      sq += diff * diff;
    }
    sol.spectralRmse = Math.sqrt(sq / 31);

    const signature = sol.components
      .map((c) => `${c.filament.id}:${c.percentage.toFixed(1)}`)
      .join('|');
    if (
      !solutions.some(
        (s) =>
          s.components.map((c) => `${c.filament.id}:${c.percentage.toFixed(1)}`).join('|') ===
          signature
      )
    ) {
      solutions.push(sol);
    }
  }

  // Pick best accuracy; prefer simpler formula if ΔE difference is negligible (< 0.15)
  let recommendedIndex = 0;
  if (solutions.length > 1) {
    let bestIdx = 0;
    for (let i = 1; i < solutions.length; i++) {
      if (solutions[i].deltaE2000 < solutions[bestIdx].deltaE2000 - 0.15) {
        bestIdx = i;
      }
    }
    recommendedIndex = bestIdx;
  }

  const bestSol = solutions[recommendedIndex];
  const advice = bestSol
    ? computeOutOfGamutAdvice(targetLab, bestSol.predictedLab, bestSol.deltaE2000)
    : null;

  return {
    targetHex,
    targetRgb,
    targetLab,
    targetSpectrum,
    solutions,
    recommendedIndex,
    outOfGamutAdvice: advice,
  };
}

/**
 * Convert wavelength (400-700nm) to approximate sRGB hex for rendering the visible spectrum axis bar
 */
export function wavelengthToHex(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (nm >= 440 && nm < 490) {
    r = 0;
    g = (nm - 440) / (490 - 440);
    b = 1;
  } else if (nm >= 490 && nm < 510) {
    r = 0;
    g = 1;
    b = -(nm - 510) / (510 - 490);
  } else if (nm >= 510 && nm < 580) {
    r = (nm - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (nm >= 580 && nm < 645) {
    r = 1;
    g = -(nm - 645) / (645 - 580);
    b = 0;
  } else if (nm >= 645 && nm <= 780) {
    r = 1;
    g = 0;
    b = 0;
  }

  let factor = 1.0;
  if (nm >= 380 && nm < 420) factor = 0.3 + (0.7 * (nm - 380)) / (420 - 380);
  else if (nm > 645 && nm <= 700) factor = 0.3 + (0.7 * (700 - nm)) / (700 - 645);

  const gamma = 0.8;
  const toByte = (c: number) =>
    c === 0 ? 0 : Math.round(255 * Math.pow(c * factor, gamma));

  return rgbToHex({ r: toByte(r), g: toByte(g), b: toByte(b) });
}

export function describeDeltaE(de: number): {
  label: string;
  tone: 'emerald' | 'blue' | 'amber' | 'rose';
  detail: string;
} {
  if (de < 1.0) {
    return {
      label: 'Coincidencia imperceptible',
      tone: 'emerald',
      detail: 'Diferencia por debajo del umbral de percepción humana estándar.',
    };
  }
  if (de < 2.0) {
    return {
      label: 'Tolerancia de laboratorio',
      tone: 'emerald',
      detail: 'Igualación industrial precisa perceptible solo bajo inspección directa.',
    };
  }
  if (de < 3.5) {
    return {
      label: 'Aproximación comercial',
      tone: 'blue',
      detail: 'Fidelidad cromática alta válida para piezas funcionales y diseño.',
    };
  }
  if (de < 6.0) {
    return {
      label: 'Variación moderada',
      tone: 'amber',
      detail: 'Desviación visible respecto al tono objetivo por límite de pigmentos.',
    };
  }
  return {
    label: 'Fuera de gama activa',
    tone: 'rose',
    detail: 'Los filamentos activos no cubren completamente esta región cromática.',
  };
}
