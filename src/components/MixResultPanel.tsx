import { useState } from 'react';
import { AlertTriangle, Check, Copy, History, RotateCcw, Trash2 } from 'lucide-react';
import {
  MaterialType,
  MixAnalysisResult,
  MixHistoryEntry,
  MixSolution,
} from '../types/filament';
import { describeDeltaE } from '../utils/spectralEngine';

interface MixResultPanelProps {
  analysis: MixAnalysisResult;
  selectedSolutionIndex: number;
  onSelectSolution: (index: number) => void;
  batchGrams: number;
  material: MaterialType;
  minPercentage: number;
  history: MixHistoryEntry[];
  currentSignature: string;
  onLoadHistoryEntry: (entry: MixHistoryEntry) => void;
  onClearHistory: () => void;
}

export function MixResultPanel({
  analysis,
  selectedSolutionIndex,
  onSelectSolution,
  batchGrams,
  material,
  minPercentage,
  history,
  currentSignature,
  onLoadHistoryEntry,
  onClearHistory,
}: MixResultPanelProps) {
  const [copied, setCopied] = useState(false);

  const activeSolution: MixSolution | undefined =
    analysis.solutions[selectedSolutionIndex] ?? analysis.solutions[0];

  if (!activeSolution) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900 mb-2">
          Sin filamentos activos para calcular
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Activa o agrega al menos un carrete en el inventario de filamentos inferior para
          computar la combinación espectral óptima.
        </p>
      </section>
    );
  }

  const deMeta = describeDeltaE(activeSolution.deltaE2000);

  const toneClasses = {
    emerald: 'text-emerald-700',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }[deMeta.tone];

  const toneSymbol = {
    emerald: '●',
    blue: '●',
    amber: '▲',
    rose: '✖',
  }[deMeta.tone];

  const handleCopyRecipe = async () => {
    const lines = [
      `Fórmula EspectroLab 3D — Objetivo ${analysis.targetHex} -> Mezcla ${activeSolution.predictedHex}`,
      `Precisión: ΔE2000 = ${activeSolution.deltaE2000.toFixed(2)} (${deMeta.label})`,
      `Lote: ${batchGrams} g (${material}, filamento 1.75 mm)${minPercentage > 0 ? ` · Mínimo ${minPercentage}%/material` : ''}`,
      '---',
      ...activeSolution.components.map(
        (c) =>
          `${c.filament.name} (${c.filament.hex}): ${c.percentage.toFixed(1)}% · ${c.grams.toFixed(1)} g · ${c.meters.toFixed(2)} m`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in some restricted frames; ignore silently
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      {/* Header Row + Solution Complexity Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight text-balance">
            Resultado de formulación espectral
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={`font-medium ${toneClasses}`}>
              {toneSymbol} {deMeta.label}
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeSolution.components.length} componentes</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Lote {batchGrams} g ({material})</span>
            {minPercentage > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Mín. {minPercentage}%/material</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyRecipe}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copiar fórmula</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bipartite Optical Swatch Comparator + Key Precision Metrics */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Bipartite Touching Field (Standard Colorimetric Comparator) */}
        <div className="xl:col-span-7 flex flex-col">
          <div className="grid grid-cols-2 h-32 rounded-lg overflow-hidden border border-slate-200">
            <div
              className="relative flex flex-col justify-end p-3"
              style={{ backgroundColor: analysis.targetHex }}
            >
              <div className="inline-flex flex-col self-start bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-black/10">
                <span className="text-[11px] font-medium text-slate-500">Objetivo</span>
                <span className="text-xs font-mono font-semibold tabular-nums text-slate-900">
                  {analysis.targetHex}
                </span>
              </div>
            </div>
            <div
              className="relative flex flex-col justify-end items-end p-3"
              style={{ backgroundColor: activeSolution.predictedHex }}
            >
              <div className="inline-flex flex-col items-end self-end bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-black/10">
                <span className="text-[11px] font-medium text-slate-500">Mezcla calculada</span>
                <span className="text-xs font-mono font-semibold tabular-nums text-slate-900">
                  {activeSolution.predictedHex}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-4 text-xs text-slate-500 font-mono tabular-nums">
            <div>
              Lab* {analysis.targetLab.L.toFixed(1)}, {analysis.targetLab.a.toFixed(1)},{' '}
              {analysis.targetLab.b.toFixed(1)}
            </div>
            <div className="text-right">
              Lab* {activeSolution.predictedLab.L.toFixed(1)},{' '}
              {activeSolution.predictedLab.a.toFixed(1)},{' '}
              {activeSolution.predictedLab.b.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Precision Metrics Grid */}
        <div className="xl:col-span-5 grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-4 bg-slate-50/70">
          <div>
            <div className="text-xs text-slate-500 mb-1">Diferencia ΔE2000</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-slate-900">
              {activeSolution.deltaE2000.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Umbral ojo humano &lt; 1.0
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Error espectral RMSE</div>
            <div className="text-2xl font-mono font-bold tabular-nums text-slate-900">
              {(activeSolution.spectralRmse * 100).toFixed(2)}
              <span className="text-xs font-normal text-slate-500 ml-1">%</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              ΔE76 clásico: {activeSolution.deltaE76.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Out of Gamut Advisory if ΔE > 3.2 */}
      {analysis.outOfGamutAdvice && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>{analysis.outOfGamutAdvice}</div>
        </div>
      )}

      {/* Complexity Alternatives Selector */}
      {analysis.solutions.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-medium text-slate-500 mr-1">Alternativas:</span>
          {analysis.solutions.map((sol, idx) => {
            const isSelected = idx === selectedSolutionIndex;
            return (
              <button
                key={sol.id}
                type="button"
                onClick={() => onSelectSolution(idx)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span>{sol.label}</span>
                <span
                  className={`font-mono tabular-nums ${
                    isSelected ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  ΔE {sol.deltaE2000.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Proportional Mixture Bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="font-medium">Distribución porcentual de la mezcla</span>
          <span className="font-mono tabular-nums">100.0 % total</span>
        </div>
        <div className="h-5 w-full rounded-md overflow-hidden border border-slate-200 flex">
          {activeSolution.components.map((comp) => (
            <div
              key={comp.filament.id}
              style={{
                width: `${comp.percentage}%`,
                backgroundColor: comp.filament.hex,
              }}
              title={`${comp.filament.name}: ${comp.percentage.toFixed(1)}%`}
              className="h-full border-r border-black/10 last:border-r-0 transition-[width] duration-200"
            />
          ))}
        </div>
      </div>

      {/* Formulation Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
              <th className="py-2.5 pr-4">Filamento</th>
              <th className="py-2.5 px-3">Hex</th>
              <th className="py-2.5 px-3 text-right">Proporción</th>
              <th className="py-2.5 px-3 text-right">Peso ({batchGrams}g)</th>
              <th className="py-2.5 pl-3 text-right">Longitud (1.75mm)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {activeSolution.components.map((comp) => (
              <tr key={comp.filament.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-6 h-6 rounded-md border border-black/15 shrink-0"
                      style={{ backgroundColor: comp.filament.hex }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {comp.filament.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {comp.filament.brand} · {comp.filament.material} · α{' '}
                        {comp.filament.tintStrength.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-600">
                  {comp.filament.hex}
                </td>
                <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                  {comp.percentage.toFixed(1)} %
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                  {comp.grams.toFixed(1)} g
                </td>
                <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-500">
                  {comp.meters.toFixed(2)} m
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent 5 Mixes Comparison History */}
      <div className="pt-6 border-t border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">
              Historial comparativo de mezclas
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              · {history.length} / 5
            </span>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Limpiar historial</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="py-5 px-4 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
            Las últimas 5 formulaciones calculadas aparecerán aquí para comparar su ΔE2000 y
            proporciones.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2 pr-3">Objetivo → Mezcla</th>
                  <th className="py-2 px-3">ΔE2000</th>
                  <th className="py-2 px-3 text-right">RMSE</th>
                  <th className="py-2 px-3">Combinación</th>
                  <th className="py-2 pl-3 text-right">Cargar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {history.map((entry) => {
                  const entryMeta = describeDeltaE(entry.deltaE2000);
                  const entryToneClass = {
                    emerald: 'text-emerald-700',
                    blue: 'text-blue-700',
                    amber: 'text-amber-700',
                    rose: 'text-rose-700',
                  }[entryMeta.tone];
                  const entryBarClass = {
                    emerald: 'bg-emerald-600',
                    blue: 'bg-blue-600',
                    amber: 'bg-amber-500',
                    rose: 'bg-rose-600',
                  }[entryMeta.tone];
                  const entrySymbol = {
                    emerald: '●',
                    blue: '●',
                    amber: '▲',
                    rose: '✖',
                  }[entryMeta.tone];

                  const isCurrent = entry.signature === currentSignature;
                  const barPct = Math.min(100, Math.max(8, (entry.deltaE2000 / 10) * 100));

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isCurrent ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-6 rounded-sm overflow-hidden border border-black/15 grid grid-cols-2 shrink-0">
                            <span style={{ backgroundColor: entry.targetHex }} />
                            <span style={{ backgroundColor: entry.predictedHex }} />
                          </div>
                          <div>
                            <div className="font-mono tabular-nums text-slate-900 font-medium">
                              {entry.targetHex} → {entry.predictedHex}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {entry.physicsMode === 'kubelka-munk' ? 'K-M' : 'Lineal'} · Mín.{' '}
                              {entry.minPercentage}%
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="w-28 space-y-1">
                          <div className={`font-mono font-semibold tabular-nums ${entryToneClass}`}>
                            {entrySymbol} {entry.deltaE2000.toFixed(2)}
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${entryBarClass}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {(entry.spectralRmse * 100).toFixed(2)}%
                      </td>

                      <td className="py-2.5 px-3 min-w-[220px]">
                        <div className="h-2 w-full rounded-xs overflow-hidden border border-black/10 flex mb-1">
                          {entry.components.map((c, idx) => (
                            <span
                              key={`${entry.id}-bar-${idx}`}
                              style={{
                                width: `${c.percentage}%`,
                                backgroundColor: c.hex,
                              }}
                              className="h-full"
                            />
                          ))}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[340px]">
                          {entry.components
                            .map((c) => `${c.name} ${c.percentage.toFixed(0)}%`)
                            .join(' · ')}
                        </div>
                      </td>

                      <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                        {isCurrent ? (
                          <span className="font-medium text-blue-700">Actual</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onLoadHistoryEntry(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
                          >
                            <RotateCcw className="w-3 h-3 text-slate-400" aria-hidden="true" />
                            <span>Cargar</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
