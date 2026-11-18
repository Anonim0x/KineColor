export function PhysicsGuide() {
  return (
    <section
      id="metodologia"
      className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      <div className="max-w-2xl">
        <h2 className="text-lg font-bold text-slate-900">
          Metodología física y aplicación en impresión 3D
        </h2>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          A diferencia del promedio RGB digital, los pigmentos plásticos absorben y dispersan luz
          de forma no lineal en cada longitud de onda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-100">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            01. Reconstrucción espectral (400–700 nm)
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Cada código RGB/Hex se convierte mediante optimización de mínima pendiente cuadrática
            en una curva continua de reflectancia de 31 bandas calibrada con el observador estándar
            CIE 1931 2° e iluminante diurno D65.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            02. Ecuación sustractiva de Kubelka-Munk
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            El motor transforma cada reflectancia en su relación absorción/dispersión{' '}
            <span className="font-mono">K/S = (1−R)² / 2R</span>, pondera por el factor tintóreo α
            de cada carrete y optimiza los porcentajes sobre el símplex para minimizar la distancia
            perceptual CIEDE2000 (ΔE).
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            03. Dosificación en taller
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Usa los gramos exactos para mezclar pellets en extrusora de filamento o pigmentos en
            resina UV, o utiliza la longitud en metros (1.75 mm) para alimentar extrusores
            mezcladores multicanal y bloques de purga calibrados.
          </p>
        </div>
      </div>
    </section>
  );
}
