import React, { useMemo, useState } from 'react';
import { FilamentWithSpectrum, MixAnalysisResult, MixSolution } from '../types/filament';
import { WAVELENGTHS, wavelengthToHex } from '../utils/spectralEngine';

interface SpectralChartProps {
  analysis: MixAnalysisResult;
  activeSolution: MixSolution | undefined;
  activeFilaments: FilamentWithSpectrum[];
}

function computeConvexHull2D(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((p, q) => (p.x !== q.x ? p.x - q.x : p.y - q.y));
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: { x: number; y: number }[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function SpectralChart({
  analysis,
  activeSolution,
  activeFilaments,
}: SpectralChartProps) {
  const [viewTab, setViewTab] = useState<'spectrum' | 'gamut'>('spectrum');
  const [showComponents, setShowComponents] = useState(true);
  const [hoverBandIdx, setHoverBandIdx] = useState<number | null>(null);

  // SVG coordinate system for Spectral Plot
  const width = 760;
  const height = 300;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 46;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xForIdx = (i: number) => padLeft + (i / 30) * plotW;
  const yForReflectance = (r: number) => padTop + (1 - Math.max(0, Math.min(1, r))) * plotH;

  const toPath = (spec: number[]) =>
    spec
      .map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${xForIdx(idx).toFixed(1)} ${yForReflectance(val).toFixed(1)}`)
      .join(' ');

  const spectrumGradientStops = useMemo(
    () =>
      WAVELENGTHS.map((nm, i) => ({
        offset: `${((i / 30) * 100).toFixed(1)}%`,
        color: wavelengthToHex(nm),
      })),
    []
  );

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const norm = (relX - padLeft) / plotW;
    if (norm < -0.02 || norm > 1.02) {
      setHoverBandIdx(null);
      return;
    }
    const idx = Math.max(0, Math.min(30, Math.round(norm * 30)));
    setHoverBandIdx(idx);
  };

  // Gamut CIELAB a*b* coordinate mapping
  const gamutSize = 360;
  const gamutCenter = gamutSize / 2;
  const labRange = 120; // -120..+120
  const mapA = (a: number) => gamutCenter + (a / labRange) * (gamutCenter - 32);
  const mapB = (b: number) => gamutCenter - (b / labRange) * (gamutCenter - 32);

  const hullPoints = useMemo(() => {
    const pts = activeFilaments.map((f) => ({ x: mapA(f.lab.a), y: mapB(f.lab.b) }));
    return computeConvexHull2D(pts);
  }, [activeFilaments]);

  const usedIds = useMemo(
    () => new Set(activeSolution?.components.map((c) => c.filament.id) ?? []),
    [activeSolution]
  );

  const hoveredNm = hoverBandIdx !== null ? WAVELENGTHS[hoverBandIdx] : null;
  const hoveredTargetR = hoverBandIdx !== null ? analysis.targetSpectrum[hoverBandIdx] : null;
  const hoveredMixR =
    hoverBandIdx !== null && activeSolution ? activeSolution.predictedSpectrum[hoverBandIdx] : null;

  return (
    <section id="espectro" className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Análisis espectral y gama cromática
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reflectancia R(λ) entre 400 nm y 700 nm bajo iluminante estándar CIE D65
          </p>
        </div>

        {/* View Mode Switch */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewTab('spectrum')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewTab === 'spectrum'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Curva espectral
          </button>
          <button
            type="button"
            onClick={() => setViewTab('gamut')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              viewTab === 'gamut'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gama CIELAB a*b*
          </button>
        </div>
      </div>

      {viewTab === 'spectrum' ? (
        <div className="space-y-4">
          {/* Legend + Component Curves Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-5 text-slate-700">
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 h-0.5 bg-slate-900" />
                <span className="font-medium">Objetivo R_T(λ)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 border-t-2 border-dashed border-blue-600" />
                <span className="font-medium">Mezcla calculada R_mix(λ)</span>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showComponents}
                onChange={(e) => setShowComponents(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Mostrar espectros individuales seleccionados</span>
            </label>
          </div>

          {/* Interactive SVG Spectrophotometer */}
          <div className="relative border border-slate-200 rounded-lg bg-slate-50/40 p-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto block cursor-crosshair select-none"
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={() => setHoverBandIdx(null)}
              role="img"
              aria-label="Gráfico de reflectancia espectral de 400 a 700 nanómetros"
            >
              <defs>
                <linearGradient id="visible-spectrum-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  {spectrumGradientStops.map((s) => (
                    <stop key={s.offset} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines (Reflectance %) */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((val) => {
                const y = yForReflectance(val);
                return (
                  <g key={val}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={width - padRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono tabular-nums"
                    >
                      {Math.round(val * 100)}%
                    </text>
                  </g>
                );
              })}

              {/* Vertical Wavelength Gridlines */}
              {[400, 450, 500, 550, 600, 650, 700].map((nm) => {
                const idx = (nm - 400) / 10;
                const x = xForIdx(idx);
                return (
                  <g key={nm}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + plotH}
                      stroke="#E2E8F0"
                      strokeDasharray="2 3"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={padTop + plotH + 28}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px] font-mono tabular-nums"
                    >
                      {nm} nm
                    </text>
                  </g>
                );
              })}

              {/* Visible Spectrum Band Strip */}
              <rect
                x={padLeft}
                y={padTop + plotH + 6}
                width={plotW}
                height={7}
                rx={2}
                fill="url(#visible-spectrum-grad)"
                opacity={0.85}
              />

              {/* Individual Component Filaments Spectra */}
              {showComponents &&
                activeSolution?.components.map((comp) => (
                  <path
                    key={comp.filament.id}
                    d={toPath(comp.filament.spectrum)}
                    fill="none"
                    stroke={comp.filament.hex === '#FFFFFF' || comp.filament.hex === '#F6F6F4' ? '#94A3B8' : comp.filament.hex}
                    strokeWidth="1.5"
                    strokeOpacity={0.42}
                  />
                ))}

              {/* Target Spectrum (Solid Slate-900) */}
              <path
                d={toPath(analysis.targetSpectrum)}
                fill="none"
                stroke="#0F172A"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Predicted Mix Spectrum (Dashed Cobalt-600) */}
              {activeSolution && (
                <path
                  d={toPath(activeSolution.predictedSpectrum)}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  strokeLinejoin="round"
                />
              )}

              {/* Crosshair Hover Probe */}
              {hoverBandIdx !== null && hoveredTargetR !== null && (
                <g>
                  <line
                    x1={xForIdx(hoverBandIdx)}
                    y1={padTop}
                    x2={xForIdx(hoverBandIdx)}
                    y2={padTop + plotH}
                    stroke="#64748B"
                    strokeWidth="1"
                  />
                  <circle
                    cx={xForIdx(hoverBandIdx)}
                    cy={yForReflectance(hoveredTargetR)}
                    r={4}
                    fill="#0F172A"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  {hoveredMixR !== null && (
                    <circle
                      cx={xForIdx(hoverBandIdx)}
                      cy={yForReflectance(hoveredMixR)}
                      r={4}
                      fill="#2563EB"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  )}
                </g>
              )}
            </svg>

            {/* Compact Monospace Probe HUD */}
            <div className="mt-2 pt-2 border-t border-slate-200/80 px-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono tabular-nums text-slate-600">
              {hoveredNm !== null && hoveredTargetR !== null ? (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-xs border border-black/15"
                      style={{ backgroundColor: wavelengthToHex(hoveredNm) }}
                    />
                    <span className="font-semibold text-slate-900">λ = {hoveredNm} nm</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Objetivo: {(hoveredTargetR * 100).toFixed(1)}%</span>
                    {hoveredMixR !== null && (
                      <>
                        <span className="text-blue-700">
                          Mezcla: {(hoveredMixR * 100).toFixed(1)}%
                        </span>
                        <span className="text-slate-500">
                          ΔR: {((hoveredMixR - hoveredTargetR) * 100 >= 0 ? '+' : '')}
                          {((hoveredMixR - hoveredTargetR) * 100).toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-slate-400">
                  Pasa el cursor sobre el gráfico para inspeccionar reflectancia por banda de 10 nm
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CIELAB a*b* Gamut Projection */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-7 flex justify-center border border-slate-200 rounded-lg bg-slate-50/40 p-4">
            <svg
              viewBox={`0 0 ${gamutSize} ${gamutSize}`}
              className="w-full max-w-[360px] h-auto"
              role="img"
              aria-label="Diagrama de cromaticidad CIELAB a* b* y envolvente de gama de filamentos"
            >
              {/* Chroma reference circles */}
              {[30, 60, 90].map((r) => (
                <circle
                  key={r}
                  cx={gamutCenter}
                  cy={gamutCenter}
                  r={(r / labRange) * (gamutCenter - 32)}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                />
              ))}

              {/* Axes a* and b* */}
              <line
                x1={24}
                y1={gamutCenter}
                x2={gamutSize - 24}
                y2={gamutCenter}
                stroke="#CBD5E1"
                strokeWidth="1"
              />
              <line
                x1={gamutCenter}
                y1={24}
                x2={gamutCenter}
                y2={gamutSize - 24}
                stroke="#CBD5E1"
                strokeWidth="1"
              />

              {/* Axis Labels */}
              <text x={gamutSize - 18} y={gamutCenter - 6} textAnchor="end" className="fill-rose-600 text-[10px] font-mono">
                +a* Rojo
              </text>
              <text x={28} y={gamutCenter - 6} textAnchor="start" className="fill-emerald-700 text-[10px] font-mono">
                -a* Verde
              </text>
              <text x={gamutCenter + 6} y={28} className="fill-amber-600 text-[10px] font-mono">
                +b* Amarillo
              </text>
              <text x={gamutCenter + 6} y={gamutSize - 20} className="fill-blue-600 text-[10px] font-mono">
                -b* Azul
              </text>

              {/* Convex Hull Gamut Polygon */}
              {hullPoints.length >= 3 && (
                <polygon
                  points={hullPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                  fill="#2563EB"
                  fillOpacity={0.07}
                  stroke="#94A3B8"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
              )}

              {/* Active Filaments */}
              {activeFilaments.map((f) => {
                const cx = mapA(f.lab.a);
                const cy = mapB(f.lab.b);
                const isUsed = usedIds.has(f.id);
                return (
                  <g key={f.id}>
                    {isUsed && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill="none"
                        stroke="#2563EB"
                        strokeWidth="1.5"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isUsed ? 5 : 4}
                      fill={f.hex}
                      stroke="#0F172A"
                      strokeWidth="1"
                    >
                      <title>{`${f.name} (a* ${f.lab.a.toFixed(1)}, b* ${f.lab.b.toFixed(1)})`}</title>
                    </circle>
                  </g>
                );
              })}

              {/* Predicted Mix Marker */}
              {activeSolution && (
                <circle
                  cx={mapA(activeSolution.predictedLab.a)}
                  cy={mapB(activeSolution.predictedLab.b)}
                  r={5.5}
                  fill={activeSolution.predictedHex}
                  stroke="#2563EB"
                  strokeWidth="2.5"
                />
              )}

              {/* Target Crosshair */}
              <g
                transform={`translate(${mapA(analysis.targetLab.a)}, ${mapB(analysis.targetLab.b)})`}
              >
                <line x1={-8} y1={0} x2={8} y2={0} stroke="#0F172A" strokeWidth="1.5" />
                <line x1={0} y1={-8} x2={0} y2={8} stroke="#0F172A" strokeWidth="1.5" />
                <circle r={3.5} fill="none" stroke="#0F172A" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          <div className="md:col-span-5 space-y-4 text-xs text-slate-600 leading-relaxed">
            <h3 className="text-sm font-semibold text-slate-900">
              Interpretación del plano cromático a*b*
            </h3>
            <p>
              El polígono sombreado representa la envolvente aproximada de tonos alcanzables al
              mezclar tus carretes activos. El eje horizontal <span className="font-mono">a*</span>{' '}
              mide verde-rojo y el vertical <span className="font-mono">b*</span> azul-amarillo.
            </p>
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-slate-900 font-bold">
                  ⊕
                </span>
                <span>Cruz negra: tono objetivo seleccionado</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full border-2 border-blue-600 inline-block" />
                <span>Círculo azul: mezcla calculada</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full border border-blue-600 bg-slate-200 inline-block" />
                <span>Anillo azul exterior: filamentos usados en la fórmula</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
