import { FilamentSpool, SpoolmanFilamentItem } from '../types/filament';
import { hexToLab, normalizeHex } from './spectralEngine';

export const SPOOLMAN_DB_URL = 'https://donkie.github.io/SpoolmanDB/filaments.json';

interface RawSpoolmanRecord {
  id: string;
  manufacturer?: string | null;
  name?: string | null;
  material?: string | null;
  density?: number | null;
  color_hex?: string | null;
  color_hexes?: string[] | null;
  finish?: string | null;
  translucent?: boolean | null;
}

let cachedCatalog: SpoolmanFilamentItem[] | null = null;

function estimateTintStrength(
  hex: string,
  translucent: boolean,
  finish: string | null
): number {
  if (translucent) return 0.55;
  const lab = hexToLab(hex);
  let alpha = 1.0;
  if (finish === 'matte') alpha += 0.12;
  if (lab.L > 90 && Math.hypot(lab.a, lab.b) < 10) alpha = 1.3; // Titanium white pigments
  if (lab.L < 14 && Math.hypot(lab.a, lab.b) < 10) alpha = 1.35; // Carbon black pigments
  return Math.round(alpha * 20) / 20;
}

export async function fetchSpoolmanCatalog(
  forceRefresh = false
): Promise<SpoolmanFilamentItem[]> {
  if (cachedCatalog && !forceRefresh) {
    return cachedCatalog;
  }

  const response = await fetch(SPOOLMAN_DB_URL, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al consultar SpoolmanDB`);
  }

  const rawList = (await response.json()) as RawSpoolmanRecord[];
  if (!Array.isArray(rawList)) {
    throw new Error('Formato inesperado en SpoolmanDB');
  }

  const seenKeys = new Set<string>();
  const uniqueItems: SpoolmanFilamentItem[] = [];

  for (const row of rawList) {
    const rawHex =
      row.color_hex ||
      (Array.isArray(row.color_hexes) && row.color_hexes.length > 0
        ? row.color_hexes[0]
        : null);
    if (!rawHex) continue;

    const cleanHex = rawHex.replace(/^#/, '').trim();
    if (!/^[0-9a-fA-F]{6,8}$/.test(cleanHex)) continue;

    const hex6 = normalizeHex(cleanHex.slice(0, 6));
    const manufacturer = (row.manufacturer || 'Genérico').trim();
    const name = (row.name || 'Sin nombre').trim();
    const material = (row.material || 'PLA').trim();

    const dedupeKey = `${manufacturer.toLowerCase()}|${name.toLowerCase()}|${material.toLowerCase()}|${hex6}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const translucent = Boolean(row.translucent);
    const finish = row.finish ?? null;

    uniqueItems.push({
      id: row.id || dedupeKey,
      manufacturer,
      name,
      material,
      hex: hex6,
      density: typeof row.density === 'number' ? row.density : null,
      finish,
      translucent,
      estimatedTintStrength: estimateTintStrength(hex6, translucent, finish),
    });
  }

  // Sort alphabetically by manufacturer then filament name
  uniqueItems.sort((a, b) => {
    const m = a.manufacturer.localeCompare(b.manufacturer);
    return m !== 0 ? m : a.name.localeCompare(b.name);
  });

  cachedCatalog = uniqueItems;
  return uniqueItems;
}

export function spoolmanKey(brand: string, name: string, material: string, hex: string): string {
  return `${brand.trim().toLowerCase()}|${name.trim().toLowerCase()}|${material.trim().toLowerCase()}|${normalizeHex(hex)}`;
}

export function toFilamentSpool(item: SpoolmanFilamentItem): FilamentSpool {
  return {
    id: `spoolman-${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: item.name,
    brand: item.manufacturer,
    material: item.material,
    hex: item.hex,
    tintStrength: item.estimatedTintStrength,
    active: true,
  };
}
