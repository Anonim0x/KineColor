import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Pipette, X } from 'lucide-react';
import {
  LabColor,
  MaterialType,
  MixingPhysicsMode,
  RgbColor,
} from '../types/filament';
import { TARGET_COLOR_PRESETS } from '../data/presets';
import {
  hexToLab,
  hexToRgb,
  labToHex,
  MATERIAL_DENSITIES,
  normalizeHex,
  rgbToHex,
} from '../utils/spectralEngine';

interface TargetColorPanelProps {
  targetHex: string;
  onChangeTargetHex: (hex: string) => void;
  material: MaterialType;
  onChangeMaterial: (material: MaterialType) => void;
  maxColors: number;
  onChangeMaxColors: (max: number) => void;
  batchGrams: number;
  onChangeBatchGrams: (grams: number) => void;
  physicsMode: MixingPhysicsMode;
  onChangePhysicsMode: (mode: MixingPhysicsMode) => void;
  minPercentage: number;
  onChangeMinPercentage: (pct: number) => void;
}

export function TargetColorPanel({
  targetHex,
  onChangeTargetHex,
  material,
  onChangeMaterial,
  maxColors,
  onChangeMaxColors,
  batchGrams,
  onChangeBatchGrams,
  physicsMode,
  onChangePhysicsMode,
  minPercentage,
  onChangeMinPercentage,
}: TargetColorPanelProps) {
  const [hexDraft, setHexDraft] = useState(targetHex);
  const [sampleImageUrl, setSampleImageUrl] = useState<string | null>(null);
  const [hoverSampleHex, setHoverSampleHex] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setHexDraft(targetHex);
  }, [targetHex]);

  const rgb: RgbColor = hexToRgb(targetHex);
  const lab: LabColor = hexToLab(targetHex);

  const handleHexInputChange = (val: string) => {
    setHexDraft(val);
    const cleaned = val.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
      onChangeTargetHex('#' + cleaned.toUpperCase());
    }
  };

  const handleHexBlur = () => {
    setHexDraft(normalizeHex(hexDraft));
    onChangeTargetHex(normalizeHex(hexDraft));
  };

  const handleRgbChange = (channel: keyof RgbColor, val: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(val || 0)));
    onChangeTargetHex(rgbToHex({ ...rgb, [channel]: clamped }));
  };

  const handleLabChange = (channel: keyof LabColor, val: number) => {
    const next = { ...lab, [channel]: val };
    if (channel === 'L') next.L = Math.max(0, Math.min(100, val));
    if (channel === 'a') next.a = Math.max(-128, Math.min(127, val));
    if (channel === 'b') next.b = Math.max(-128, Math.min(127, val));
    onChangeTargetHex(labToHex(next));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSampleImageUrl(url);
  };

  useEffect(() => {
    if (!sampleImageUrl || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 340;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };
    img.src = sampleImageUrl;
    return () => {
      URL.revokeObjectURL(sampleImageUrl);
    };
  }, [sampleImageUrl]);

  const sampleCanvasAt = (e: React.MouseEvent<HTMLCanvasElement>): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(canvas.width - 1, Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width))
    );
    const y = Math.max(
      0,
      Math.min(canvas.height - 1, Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height))
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const data = ctx.getImageData(x, y, 1, 1).data;
    return rgbToHex({ r: data[0], g: data[1], b: data[2] });
  };

  return (
    <aside className="w-full lg:w-[370px] shrink-0 space-y-6">
      {/* Section 1: Target Color Input */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900">Color objetivo</h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Iluminante D65 · 2°
          </span>
        </div>

        {/* Picker + Hex Row */}
        <div className="flex items-center gap-3 mb-5">
          <label className="relative block w-14 h-14 rounded-lg border border-slate-200 overflow-hidden cursor-pointer shrink-0">
            <input
              type="color"
              value={targetHex}
              onChange={(e) => onChangeTargetHex(e.target.value.toUpperCase())}
              aria-label="Selector visual de color objetivo"
              className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer border-0 p-0"
            />
          </label>
          <div className="flex-1 min-w-0">
            <label htmlFor="target-hex-input" className="block text-xs font-medium text-slate-500 mb-1">
              Código Hexadecimal
            </label>
            <div className="flex items-center gap-2">
              <input
                id="target-hex-input"
                type="text"
                value={hexDraft}
                onChange={(e) => handleHexInputChange(e.target.value)}
                onBlur={handleHexBlur}
                maxLength={7}
                className="w-full px-3 py-1.5 text-sm font-mono tabular-nums uppercase bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                placeholder="#C25E44"
              />
            </div>
          </div>
        </div>

        {/* RGB Direct Inputs */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Canales sRGB</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {rgb.r}, {rgb.g}, {rgb.b}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['r', 'g', 'b'] as const).map((ch) => (
              <div key={ch}>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                  {ch.toUpperCase()}
                </label>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={rgb[ch]}
                  onChange={(e) => handleRgbChange(ch, Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>
            ))}
          </div>
        </div>

        {/* CIELAB Direct Inputs */}
        <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Coordenadas CIELAB</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              L* {lab.L.toFixed(1)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">L*</label>
              <input
                type="number"
                step={0.5}
                min={0}
                max={100}
                value={Number(lab.L.toFixed(1))}
                onChange={(e) => handleLabChange('L', Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">a*</label>
              <input
                type="number"
                step={0.5}
                min={-128}
                max={127}
                value={Number(lab.a.toFixed(1))}
                onChange={(e) => handleLabChange('a', Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">b*</label>
              <input
                type="number"
                step={0.5}
                min={-128}
                max={127}
                value={Number(lab.b.toFixed(1))}
                onChange={(e) => handleLabChange('b', Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Image Color Eyedropper */}
        <div className="pt-4 mt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Muestrear desde imagen</span>
            {sampleImageUrl && (
              <button
                type="button"
                onClick={() => {
                  setSampleImageUrl(null);
                  setHoverSampleHex(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Quitar</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {!sampleImageUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>Cargar foto o paleta para capturar tono</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <canvas
                  ref={canvasRef}
                  onMouseMove={(e) => setHoverSampleHex(sampleCanvasAt(e))}
                  onMouseLeave={() => setHoverSampleHex(null)}
                  onClick={(e) => {
                    const hex = sampleCanvasAt(e);
                    if (hex) onChangeTargetHex(hex);
                  }}
                  className="w-full h-auto block cursor-crosshair"
                />
                {hoverSampleHex && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-white/95 border border-slate-200 rounded-md text-[11px] font-mono tabular-nums text-slate-800 shadow-xs pointer-events-none">
                    <span
                      className="w-3 h-3 rounded-xs border border-slate-300"
                      style={{ backgroundColor: hoverSampleHex }}
                    />
                    <span>{hoverSampleHex}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Pipette className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Haz clic en cualquier píxel de la imagen para fijar el tono objetivo.</span>
              </p>
            </div>
          )}
        </div>

        {/* Target Color Presets */}
        <div className="pt-4 mt-4 border-t border-slate-100">
          <span className="block text-xs font-medium text-slate-500 mb-2.5">
            Tonos de referencia rápida
          </span>
          <div className="grid grid-cols-4 gap-2">
            {TARGET_COLOR_PRESETS.map((preset) => {
              const isSelected = targetHex === preset.hex;
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => onChangeTargetHex(preset.hex)}
                  title={`${preset.name} (${preset.hex})`}
                  className={`group text-left p-1.5 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    className="w-full h-6 rounded-sm border border-black/10 mb-1"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <div className="text-[11px] font-medium text-slate-700 truncate">
                    {preset.name.split(' ')[0]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Formulation Parameters */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-900">Parámetros de formulación</h2>

        {/* Physics Mode */}
        <div>
          <span className="block text-xs font-medium text-slate-500 mb-2">
            Modelo óptico de mezcla
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onChangePhysicsMode('kubelka-munk')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                physicsMode === 'kubelka-munk'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kubelka-Munk
            </button>
            <button
              type="button"
              onClick={() => onChangePhysicsMode('spectral-linear')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                physicsMode === 'spectral-linear'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lineal Espectral
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
            {physicsMode === 'kubelka-munk'
              ? 'Absorción y dispersión sustractiva (K/S) para filamento fundido opaco o resina pigmentada.'
              : 'Promedio espectral directo para tintas translúcidas o laminado óptico por capas.'}
          </p>
        </div>

        {/* Max Colors in Formula */}
        <div>
          <span className="block text-xs font-medium text-slate-500 mb-2">
            Límite máximo de colores
          </span>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { value: 2, label: '2 máx.' },
              { value: 3, label: '3 máx.' },
              { value: 4, label: '4 máx.' },
              { value: 0, label: 'Todos' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeMaxColors(opt.value)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  maxColors === opt.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Min Percentage Per Material */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">
              Mínimo por material incluido
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-700">
              {minPercentage > 0 ? `≥ ${minPercentage}%` : 'Libre'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { value: 0, label: 'Libre' },
              { value: 5, label: '5%' },
              { value: 10, label: '10%' },
              { value: 15, label: '15%' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeMinPercentage(opt.value)}
                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  minPercentage === opt.value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
            Ningún filamento de la mezcla tendrá una proporción menor a este umbral.
          </p>
        </div>

        {/* Batch Weight & Material */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="batch-grams" className="block text-xs font-medium text-slate-500 mb-1.5">
              Peso del lote (g)
            </label>
            <input
              id="batch-grams"
              type="number"
              min={1}
              max={50000}
              step={10}
              value={batchGrams}
              onChange={(e) => onChangeBatchGrams(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="material-select" className="block text-xs font-medium text-slate-500 mb-1.5">
              Polímero base
            </label>
            <select
              id="material-select"
              value={material}
              onChange={(e) => onChangeMaterial(e.target.value as MaterialType)}
              className="w-full px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            >
              {(Object.keys(MATERIAL_DENSITIES) as MaterialType[]).map((m) => (
                <option key={m} value={m}>
                  {m} ({MATERIAL_DENSITIES[m]} g/cm³)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[50, 100, 250, 500, 1000].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onChangeBatchGrams(g)}
              className={`flex-1 py-1 text-xs font-mono tabular-nums rounded-md border transition-colors ${
                batchGrams === g
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {g}g
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
