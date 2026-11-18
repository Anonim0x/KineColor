import { useEffect, useMemo, useState } from 'react';
import { FilamentInventory } from './components/FilamentInventory';
import { MixResultPanel } from './components/MixResultPanel';
import { PhysicsGuide } from './components/PhysicsGuide';
import { SpectralChart } from './components/SpectralChart';
import { TargetColorPanel } from './components/TargetColorPanel';
import { TopBar } from './components/TopBar';
import { FILAMENT_KIT_PRESETS, instantiateKit } from './data/presets';
import {
  FilamentSpool,
  MaterialType,
  MixHistoryEntry,
  MixingPhysicsMode,
} from './types/filament';
import {
  calculateFilamentMix,
  enrichFilament,
  MATERIAL_DENSITIES,
} from './utils/spectralEngine';

const STORAGE_KEY_INVENTORY = 'espectrolab3d_inventory_v1';
const STORAGE_KEY_TARGET = 'espectrolab3d_target_v1';
const STORAGE_KEY_HISTORY = 'espectrolab3d_history_v1';
const MAX_MIX_HISTORY = 5;

function loadInitialHistory(): MixHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_MIX_HISTORY);
      }
    }
  } catch {
    // Fallback to empty history
  }
  return [];
}

function loadInitialInventory(): FilamentSpool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INVENTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to starter kit
  }
  return instantiateKit(FILAMENT_KIT_PRESETS[0]);
}

function loadInitialTarget(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TARGET);
    if (raw && /^#[0-9A-Fa-f]{6}$/.test(raw)) {
      return raw.toUpperCase();
    }
  } catch {
    // Fallback to Terracota Mate
  }
  return '#C25E44';
}

export default function App() {
  const [filaments, setFilaments] = useState<FilamentSpool[]>(loadInitialInventory);
  const [targetHex, setTargetHex] = useState<string>(loadInitialTarget);
  const [material, setMaterial] = useState<MaterialType>('PLA');
  const [maxColors, setMaxColors] = useState<number>(3);
  const [batchGrams, setBatchGrams] = useState<number>(100);
  const [physicsMode, setPhysicsMode] = useState<MixingPhysicsMode>('kubelka-munk');
  const [minPercentage, setMinPercentage] = useState<number>(10);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState<number>(0);
  const [mixHistory, setMixHistory] = useState<MixHistoryEntry[]>(loadInitialHistory);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_INVENTORY, JSON.stringify(filaments));
    } catch {
      // Ignore storage quota errors
    }
  }, [filaments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TARGET, targetHex);
    } catch {
      // Ignore storage quota errors
    }
  }, [targetHex]);

  const analysis = useMemo(
    () =>
      calculateFilamentMix(targetHex, filaments, {
        maxColors,
        batchGrams,
        materialDensity: MATERIAL_DENSITIES[material],
        physicsMode,
        minComponentRatio: minPercentage / 100,
      }),
    [targetHex, filaments, maxColors, batchGrams, material, physicsMode, minPercentage]
  );

  // Keep selected solution aligned with optimal recommendation when inputs change
  useEffect(() => {
    setSelectedSolutionIndex(analysis.recommendedIndex);
  }, [analysis.recommendedIndex, targetHex, maxColors, physicsMode, minPercentage, filaments]);

  const activeSolution =
    analysis.solutions[selectedSolutionIndex] ?? analysis.solutions[0];

  const activeEnrichedFilaments = useMemo(
    () => filaments.filter((f) => f.active).map(enrichFilament),
    [filaments]
  );

  const usedFilamentIds = useMemo(
    () => new Set(activeSolution?.components.map((c) => c.filament.id) ?? []),
    [activeSolution]
  );

  const currentSignature = useMemo(() => {
    if (!activeSolution) return '';
    const compSig = activeSolution.components
      .map((c) => `${c.filament.id}:${c.percentage.toFixed(1)}`)
      .join(',');
    return `${analysis.targetHex}|${activeSolution.predictedHex}|${physicsMode}|${minPercentage}|${maxColors}|${compSig}`;
  }, [activeSolution, analysis.targetHex, physicsMode, minPercentage, maxColors]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(mixHistory));
    } catch {
      // Ignore storage quota errors
    }
  }, [mixHistory]);

  // Automatically record settled calculations into the 5-item comparison history
  useEffect(() => {
    if (!activeSolution || !currentSignature) return;

    const recordEntry = () => {
      setMixHistory((prev) => {
        if (prev[0]?.signature === currentSignature) return prev;
        const entry: MixHistoryEntry = {
          id: `mix-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          signature: currentSignature,
          timestamp: Date.now(),
          targetHex: analysis.targetHex,
          predictedHex: activeSolution.predictedHex,
          deltaE2000: activeSolution.deltaE2000,
          spectralRmse: activeSolution.spectralRmse,
          physicsMode,
          maxColors,
          minPercentage,
          material,
          components: activeSolution.components.map((c) => ({
            name: c.filament.name,
            hex: c.filament.hex,
            percentage: c.percentage,
          })),
        };
        const deduped = prev.filter((item) => item.signature !== currentSignature);
        return [entry, ...deduped].slice(0, MAX_MIX_HISTORY);
      });
    };

    // Record immediately if history is empty; otherwise debounce slider drags (450ms)
    const delay = mixHistory.length === 0 ? 0 : 450;
    const timer = window.setTimeout(recordEntry, delay);
    return () => window.clearTimeout(timer);
  }, [
    activeSolution,
    currentSignature,
    analysis.targetHex,
    physicsMode,
    maxColors,
    minPercentage,
    material,
    mixHistory.length,
  ]);

  const handleLoadHistoryEntry = (entry: MixHistoryEntry) => {
    setTargetHex(entry.targetHex);
    setPhysicsMode(entry.physicsMode);
    setMaxColors(entry.maxColors);
    setMinPercentage(entry.minPercentage);
    setMaterial(entry.material);
  };

  const handleClearHistory = () => {
    setMixHistory([]);
  };

  const handleExportCsv = () => {
    if (!activeSolution) return;
    const rows = [
      ['EspectroLab 3D - Receta Espectral de Filamento'],
      ['Color Objetivo Hex', analysis.targetHex],
      ['Color Mezcla Predicho Hex', activeSolution.predictedHex],
      ['Delta E2000', activeSolution.deltaE2000.toFixed(3)],
      ['RMSE Espectral (%)', (activeSolution.spectralRmse * 100).toFixed(3)],
      ['Modelo Fisico', physicsMode],
      ['Material Base', material],
      ['Lote Total (g)', batchGrams.toFixed(1)],
      ['Minimo por material (%)', minPercentage.toString()],
      [],
      ['Filamento', 'Marca', 'Material', 'Hex', 'Poder Tintoreo', 'Porcentaje (%)', 'Peso (g)', 'Longitud 1.75mm (m)'],
      ...activeSolution.components.map((c) => [
        c.filament.name,
        c.filament.brand,
        c.filament.material,
        c.filament.hex,
        c.filament.tintStrength.toFixed(2),
        c.percentage.toFixed(2),
        c.grams.toFixed(2),
        c.meters.toFixed(3),
      ]),
    ];

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receta-filamento-${analysis.targetHex.slice(1)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar onExportCsv={handleExportCsv} hasSolution={Boolean(activeSolution)} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Asymmetric Split Console: Left Target/Parameters + Right Results & Spectrophotometer */}
        <div id="mezclador" className="flex flex-col lg:flex-row gap-6 items-start">
          <TargetColorPanel
            targetHex={targetHex}
            onChangeTargetHex={setTargetHex}
            material={material}
            onChangeMaterial={setMaterial}
            maxColors={maxColors}
            onChangeMaxColors={setMaxColors}
            batchGrams={batchGrams}
            onChangeBatchGrams={setBatchGrams}
            physicsMode={physicsMode}
            onChangePhysicsMode={setPhysicsMode}
            minPercentage={minPercentage}
            onChangeMinPercentage={setMinPercentage}
          />

          <div className="flex-1 min-w-0 w-full space-y-6">
            <MixResultPanel
              analysis={analysis}
              selectedSolutionIndex={selectedSolutionIndex}
              onSelectSolution={setSelectedSolutionIndex}
              batchGrams={batchGrams}
              material={material}
              minPercentage={minPercentage}
              history={mixHistory}
              currentSignature={currentSignature}
              onLoadHistoryEntry={handleLoadHistoryEntry}
              onClearHistory={handleClearHistory}
            />

            <SpectralChart
              analysis={analysis}
              activeSolution={activeSolution}
              activeFilaments={activeEnrichedFilaments}
            />
          </div>
        </div>

        {/* Filament Spools Inventory Workbench */}
        <FilamentInventory
          filaments={filaments}
          onChangeFilaments={setFilaments}
          usedFilamentIds={usedFilamentIds}
        />

        {/* Scientific Methodology Reference */}
        <PhysicsGuide />
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1440px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>EspectroLab 3D · Formulación espectral de filamentos y resinas</span>
          <span className="font-mono tabular-nums">
            Observador CIE 1931 2° · Iluminante D65 · 400–700 nm
          </span>
        </div>
      </footer>
    </div>
  );
}
