import React, { useState } from 'react';
import { CloudDownload, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { FilamentSpool, MaterialType } from '../types/filament';
import { FILAMENT_KIT_PRESETS, instantiateKit } from '../data/presets';
import { hexToLab, normalizeHex } from '../utils/spectralEngine';
import { spoolmanKey } from '../utils/spoolmanDb';
import { SpoolmanImporterModal } from './SpoolmanImporterModal';

interface FilamentInventoryProps {
  filaments: FilamentSpool[];
  onChangeFilaments: (next: FilamentSpool[]) => void;
  usedFilamentIds: Set<string>;
}

export function FilamentInventory({
  filaments,
  onChangeFilaments,
  usedFilamentIds,
}: FilamentInventoryProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'used'>('all');
  const [isSpoolmanOpen, setIsSpoolmanOpen] = useState(false);

  // New spool form state
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('Mi Taller');
  const [newMaterial, setNewMaterial] = useState<MaterialType>('PLA');
  const [newHex, setNewHex] = useState('#EA580C');
  const [newTint, setNewTint] = useState(1.0);

  const handleAddFilament = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    const spool: FilamentSpool = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      brand: newBrand.trim() || 'Genérico',
      material: newMaterial,
      hex: normalizeHex(newHex),
      tintStrength: Math.max(0.2, Math.min(2.0, newTint)),
      active: true,
    };

    onChangeFilaments([spool, ...filaments]);
    setNewName('');
  };

  const updateSpool = (id: string, patch: Partial<FilamentSpool>) => {
    onChangeFilaments(
      filaments.map((f) => (f.id === id ? { ...f, ...patch } : f))
    );
  };

  const deleteSpool = (id: string) => {
    onChangeFilaments(filaments.filter((f) => f.id !== id));
  };

  const loadPresetKit = (kitId: string) => {
    const kit = FILAMENT_KIT_PRESETS.find((k) => k.id === kitId);
    if (!kit) return;
    onChangeFilaments(instantiateKit(kit));
  };

  const handleImportSpoolman = (imported: FilamentSpool[]) => {
    const existing = new Set(
      filaments.map((f) => spoolmanKey(f.brand, f.name, f.material, f.hex))
    );
    const fresh = imported.filter(
      (item) => !existing.has(spoolmanKey(item.brand, item.name, item.material, item.hex))
    );
    if (fresh.length > 0) {
      onChangeFilaments([...fresh, ...filaments]);
    }
  };

  const filtered = filaments.filter((f) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.brand.toLowerCase().includes(q) ||
      f.hex.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterMode === 'active') return f.active;
    if (filterMode === 'used') return usedFilamentIds.has(f.id);
    return true;
  });

  const activeCount = filaments.filter((f) => f.active).length;

  return (
    <section id="inventario" className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Inventario de filamentos disponibles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCount} de {filaments.length} carretes activos en el cálculo · Ajusta el poder
            tintóreo (α) para pigmentos muy opacos o translúcidos
          </p>
        </div>

        {/* External DB Import + Kit Presets Loader */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSpoolmanOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <CloudDownload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Importar de SpoolmanDB</span>
          </button>

          <span className="text-xs text-slate-400 hidden sm:inline" aria-hidden="true">
            |
          </span>
          <span className="text-xs text-slate-500">Kits:</span>
          {FILAMENT_KIT_PRESETS.map((kit) => (
            <button
              key={kit.id}
              type="button"
              onClick={() => loadPresetKit(kit.id)}
              title={kit.description}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" aria-hidden="true" />
              <span>{kit.name.split(' (')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Add New Filament Form */}
      <form
        onSubmit={handleAddFilament}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg items-end"
      >
        <div className="lg:col-span-3">
          <label htmlFor="new-fil-name" className="block text-xs font-medium text-slate-600 mb-1">
            Nombre del filamento
          </label>
          <input
            id="new-fil-name"
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Naranja Prusa"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="new-fil-brand" className="block text-xs font-medium text-slate-600 mb-1">
            Marca
          </label>
          <input
            id="new-fil-brand"
            type="text"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            placeholder="Bambu / Polymaker"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="lg:col-span-1">
          <label htmlFor="new-fil-mat" className="block text-xs font-medium text-slate-600 mb-1">
            Tipo
          </label>
          <select
            id="new-fil-mat"
            value={newMaterial}
            onChange={(e) => setNewMaterial(e.target.value as MaterialType)}
            className="w-full px-2 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
          >
            <option value="PLA">PLA</option>
            <option value="PETG">PETG</option>
            <option value="ABS">ABS</option>
            <option value="ASA">ASA</option>
            <option value="RESINA">RESINA</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="new-fil-hex" className="block text-xs font-medium text-slate-600 mb-1">
            Color (Hex)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeHex(newHex)}
              onChange={(e) => setNewHex(e.target.value.toUpperCase())}
              aria-label="Selector de color del nuevo filamento"
              className="w-9 h-9 rounded-md border border-slate-200 cursor-pointer p-0 bg-white shrink-0"
            />
            <input
              id="new-fil-hex"
              type="text"
              value={newHex}
              onChange={(e) => setNewHex(e.target.value.toUpperCase())}
              maxLength={7}
              className="w-full px-2.5 py-2 text-xs font-mono tabular-nums uppercase bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
            <label htmlFor="new-fil-tint">Poder tintóreo α</label>
            <span className="font-mono tabular-nums text-slate-900">{newTint.toFixed(2)}×</span>
          </div>
          <input
            id="new-fil-tint"
            type="range"
            min={0.25}
            max={1.75}
            step={0.05}
            value={newTint}
            onChange={(e) => setNewTint(Number(e.target.value))}
            className="lab-slider w-full my-2.5"
          />
        </div>

        <div className="lg:col-span-2">
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Añadir carrete</span>
          </button>
        </div>
      </form>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar filamento, marca o hex..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'active', label: 'Activos' },
              { id: 'used', label: 'En fórmula' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id as 'all' | 'active' | 'used')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterMode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              onChangeFilaments(filaments.map((f) => ({ ...f, active: activeCount < filaments.length })))
            }
            className="text-xs font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
          >
            {activeCount < filaments.length ? 'Activar todos' : 'Desactivar todos'}
          </button>
        </div>
      </div>

      {/* Filament Table */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
          No hay filamentos que coincidan con el filtro actual.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3 w-10">Uso</th>
                <th className="py-2.5 px-3">Color</th>
                <th className="py-2.5 px-3">Nombre y marca</th>
                <th className="py-2.5 px-3">Material</th>
                <th className="py-2.5 px-3">CIELAB (L* a* b*)</th>
                <th className="py-2.5 px-3">Poder tintóreo α</th>
                <th className="py-2.5 pl-3 text-right w-14">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((spool) => {
                const lab = hexToLab(spool.hex);
                const isUsed = usedFilamentIds.has(spool.id);
                return (
                  <tr
                    key={spool.id}
                    className={`transition-colors ${
                      spool.active ? 'hover:bg-slate-50/80' : 'opacity-55 bg-slate-50/40'
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <input
                        type="checkbox"
                        checked={spool.active}
                        onChange={(e) => updateSpool(spool.id, { active: e.target.checked })}
                        aria-label={`Activar ${spool.name}`}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={normalizeHex(spool.hex)}
                          onChange={(e) =>
                            updateSpool(spool.id, { hex: e.target.value.toUpperCase() })
                          }
                          aria-label={`Editar color de ${spool.name}`}
                          className="w-7 h-7 rounded-md border border-black/15 cursor-pointer p-0 bg-transparent shrink-0"
                        />
                        <span className="font-mono text-xs tabular-nums text-slate-600">
                          {spool.hex}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{spool.name}</span>
                        {isUsed && (
                          <span className="text-[11px] font-medium text-blue-700">
                            · En receta
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{spool.brand}</div>
                    </td>
                    <td className="py-3 px-3 text-xs font-mono text-slate-600">
                      {spool.material}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs tabular-nums text-slate-500">
                      {lab.L.toFixed(0)} · {lab.a.toFixed(0)} · {lab.b.toFixed(0)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 max-w-[160px]">
                        <input
                          type="range"
                          min={0.25}
                          max={1.75}
                          step={0.05}
                          value={spool.tintStrength}
                          onChange={(e) =>
                            updateSpool(spool.id, { tintStrength: Number(e.target.value) })
                          }
                          aria-label={`Poder tintóreo de ${spool.name}`}
                          className="lab-slider flex-1"
                        />
                        <span className="font-mono text-xs tabular-nums text-slate-700 w-10 text-right">
                          {spool.tintStrength.toFixed(2)}×
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteSpool(spool.id)}
                        aria-label={`Eliminar ${spool.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SpoolmanImporterModal
        isOpen={isSpoolmanOpen}
        onClose={() => setIsSpoolmanOpen(false)}
        existingFilaments={filaments}
        onImportFilaments={handleImportSpoolman}
      />
    </section>
  );
}
