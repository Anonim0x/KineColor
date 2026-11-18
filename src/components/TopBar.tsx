import { Download } from 'lucide-react';

interface TopBarProps {
  onExportCsv: () => void;
  hasSolution: boolean;
}

export function TopBar({ onExportCsv, hasSolution }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          EspectroLab 3D
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a
            href="#mezclador"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Mezclador
          </a>
          <a
            href="#espectro"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Espectrofotómetro
          </a>
          <a
            href="#inventario"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Inventario
          </a>
          <a
            href="#metodologia"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Metodología
          </a>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!hasSolution}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Exportar receta</span>
          </button>
        </div>
      </div>
    </header>
  );
}
