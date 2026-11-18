import { useEffect, useMemo, useState } from 'react';
import { Check, CloudDownload, Plus, RefreshCw, Search, X } from 'lucide-react';
import { FilamentSpool, SpoolmanFilamentItem } from '../types/filament';
import {
  fetchSpoolmanCatalog,
  spoolmanKey,
  toFilamentSpool,
} from '../utils/spoolmanDb';

interface SpoolmanImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFilaments: FilamentSpool[];
  onImportFilaments: (items: FilamentSpool[]) => void;
}

const PAGE_SIZE = 60;

export function SpoolmanImporterModal({
  isOpen,
  onClose,
  existingFilaments,
  onImportFilaments,
}: SpoolmanImporterModalProps) {
  const [catalog, setCatalog] = useState<SpoolmanFilamentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('ALL');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [hideExisting, setHideExisting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchSpoolmanCatalog(force);
      setCatalog(items);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con SpoolmanDB.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (catalog.length === 0) {
      void loadData(false);
    }
  }, [isOpen, catalog.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of existingFilaments) {
      keys.add(spoolmanKey(f.brand, f.name, f.material, f.hex));
    }
    return keys;
  }, [existingFilaments]);

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalog) set.add(item.manufacturer);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalog) set.add(item.material);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((item) => {
      if (manufacturerFilter !== 'ALL' && item.manufacturer !== manufacturerFilter) {
        return false;
      }
      if (materialFilter !== 'ALL' && item.material !== materialFilter) {
        return false;
      }
      if (
        hideExisting &&
        existingKeys.has(spoolmanKey(item.manufacturer, item.name, item.material, item.hex))
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.material.toLowerCase().includes(q) ||
        item.hex.toLowerCase().includes(q)
      );
    });
  }, [catalog, search, manufacturerFilter, materialFilter, hideExisting, existingKeys]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, manufacturerFilter, materialFilter, hideExisting]);

  if (!isOpen) return null;

  const visibleSlice = filtered.slice(0, visibleCount);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const item of visibleSlice) {
        if (!existingKeys.has(spoolmanKey(item.manufacturer, item.name, item.material, item.hex))) {
          next.add(item.id);
        }
      }
      return next;
    });
  };

  const handleQuickAdd = (item: SpoolmanFilamentItem) => {
    onImportFilaments([toFilamentSpool(item)]);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const handleImportSelected = () => {
    const toImport = catalog
      .filter((item) => selectedIds.has(item.id))
      .filter(
        (item) =>
          !existingKeys.has(spoolmanKey(item.manufacturer, item.name, item.material, item.hex))
      )
      .map(toFilamentSpool);

    if (toImport.length > 0) {
      onImportFilaments(toImport);
    }
    setSelectedIds(new Set());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spoolman-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-lg">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 id="spoolman-modal-title" className="text-base font-bold text-slate-900">
              Importar materiales desde SpoolmanDB
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Catálogo comunitario abierto ({catalog.length.toLocaleString('es-ES')} colores únicos ·{' '}
              {manufacturers.length} fabricantes)
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading}
              title="Actualizar catálogo desde SpoolmanDB"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Sincronizar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar importador"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5 relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar color, nombre o hex..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={manufacturerFilter}
                onChange={(e) => setManufacturerFilter(e.target.value)}
                aria-label="Filtrar por fabricante"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Todos los fabricantes ({manufacturers.length})</option>
                {manufacturers.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                aria-label="Filtrar por material"
                className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">Todos los materiales</option>
                {materials.map((mat) => (
                  <option key={mat} value={mat}>
                    {mat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-600">
              <span className="font-mono tabular-nums">
                {filtered.length.toLocaleString('es-ES')} resultados
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideExisting}
                  onChange={(e) => setHideExisting(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Ocultar ya en inventario</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSelectVisible}
                disabled={visibleSlice.length === 0}
                className="font-medium text-blue-600 hover:text-blue-800 disabled:opacity-40"
              >
                Seleccionar visibles ({visibleSlice.length})
              </button>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="font-medium text-slate-500 hover:text-slate-800"
                >
                  Limpiar selección
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {loading ? (
            <div className="space-y-2.5 py-4">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-11 rounded-lg bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm font-medium text-rose-700">{error}</p>
              <button
                type="button"
                onClick={() => void loadData(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reintentar conexión</span>
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No se encontraron filamentos con esos criterios en SpoolmanDB.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleSlice.map((item) => {
                const alreadyInInventory = existingKeys.has(
                  spoolmanKey(item.manufacturer, item.name, item.material, item.hex)
                );
                const isSelected = selectedIds.has(item.id);

                return (
                  <div
                    key={item.id}
                    className={`py-2.5 flex items-center justify-between gap-3 text-sm transition-colors ${
                      alreadyInInventory ? 'opacity-60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        disabled={alreadyInInventory}
                        checked={isSelected || alreadyInInventory}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Seleccionar ${item.manufacturer} ${item.name}`}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                      <span
                        className="w-7 h-7 rounded-md border border-black/15 shrink-0"
                        style={{ backgroundColor: item.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                          <span>{item.manufacturer}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{item.material}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{item.hex}</span>
                          {item.translucent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Translúcido (α {item.estimatedTintStrength.toFixed(2)})</span>
                            </>
                          )}
                          {item.finish && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{item.finish}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {alreadyInInventory ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 px-2.5 py-1">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>En inventario</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleQuickAdd(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                          <span>Añadir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length > visibleCount && (
                <div className="py-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  >
                    Mostrar {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más (de{' '}
                    {(filtered.length - visibleCount).toLocaleString('es-ES')} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <CloudDownload className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span>Fuente: Donkie/SpoolmanDB</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleImportSelected}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap"
            >
              Importar seleccionados ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
