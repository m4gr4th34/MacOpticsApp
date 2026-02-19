import { Plus, Trash2 } from 'lucide-react'
import type { SystemState, Surface } from '../types/system'
import { config } from '../config'

type SystemEditorProps = {
  systemState: SystemState
  onSystemStateChange: (state: SystemState | ((prev: SystemState) => SystemState)) => void
  onLoadComplete?: (fileName: string) => void
  selectedSurfaceId: string | null
  onSelectSurface: (id: string | null) => void
}

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-cyan-electric/50'

export function SystemEditor({
  systemState,
  onSystemStateChange,
  onLoadComplete: _onLoadComplete, // Reserved for load/save design
  selectedSurfaceId,
  onSelectSurface,
}: SystemEditorProps) {
  const surfaces = systemState.surfaces

  const addSurfaceAtStart = () => {
    const d = config.surfaceDefaults
    const newSurface: Surface = {
      id: crypto.randomUUID(),
      type: 'Air',
      radius: 0,
      thickness: d.thickness,
      refractiveIndex: 1,
      diameter: d.diameter,
      material: 'Air',
      description: 'New surface',
    }
    onSystemStateChange((prev) => ({
      ...prev,
      surfaces: [newSurface, ...prev.surfaces],
      traceResult: null,
      traceError: null,
    }))
  }

  const removeSurface = (id: string) => {
    onSystemStateChange((prev) => ({
      ...prev,
      surfaces: prev.surfaces.filter((s) => s.id !== id),
      traceResult: null,
      traceError: null,
    }))
    if (selectedSurfaceId === id) onSelectSurface(null)
  }

  const updateSurface = (id: string, updates: Partial<Surface>) => {
    onSystemStateChange((prev) => ({
      ...prev,
      surfaces: prev.surfaces.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
      traceResult: null,
      traceError: null,
    }))
  }

  return (
    <div className="p-4">
      <h2 className="text-cyan-electric font-semibold text-lg mb-4">System Editor</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-400 border-b border-white/10">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Radius (mm)</th>
              <th className="py-2 pr-4">Thickness (mm)</th>
              <th className="py-2 pr-4">n</th>
              <th className="py-2 pr-4">Diameter (mm)</th>
              <th className="py-2 pr-4">Material</th>
              <th className="py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            <tr
              data-testid="insert-surface-at-start"
              onClick={addSurfaceAtStart}
              className="border-b border-dashed border-white/20 cursor-pointer hover:bg-white/5 text-slate-500 hover:text-cyan-electric transition-colors"
            >
              <td colSpan={8} className="py-2">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Insert surface at start
                </span>
              </td>
            </tr>
            {surfaces.map((s, i) => (
              <tr
                key={s.id}
                onClick={() => onSelectSurface(s.id)}
                className={`border-b border-white/10 cursor-pointer transition-colors ${
                  selectedSurfaceId === s.id
                    ? 'bg-cyan-electric/10'
                    : 'hover:bg-white/5'
                }`}
              >
                <td className="py-2 pr-4 text-slate-400">{i + 1}</td>
                <td className="py-2 pr-4">
                  <select
                    value={s.type}
                    onChange={(e) => updateSurface(s.id, { type: e.target.value as 'Glass' | 'Air' })}
                    onClick={(e) => e.stopPropagation()}
                    className={inputClass}
                  >
                    <option value="Glass">Glass</option>
                    <option value="Air">Air</option>
                  </select>
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.radius}
                    onChange={(e) => updateSurface(s.id, { radius: Number(e.target.value) || 0 })}
                    onClick={(e) => e.stopPropagation()}
                    className={inputClass}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.thickness}
                    onChange={(e) => updateSurface(s.id, { thickness: Number(e.target.value) || 0 })}
                    onClick={(e) => e.stopPropagation()}
                    className={inputClass}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.refractiveIndex}
                    onChange={(e) => updateSurface(s.id, { refractiveIndex: Number(e.target.value) || 1 })}
                    onClick={(e) => e.stopPropagation()}
                    className={inputClass}
                    step={0.01}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.diameter}
                    onChange={(e) => updateSurface(s.id, { diameter: Number(e.target.value) || 0 })}
                    onClick={(e) => e.stopPropagation()}
                    className={inputClass}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    value={s.material}
                    onChange={(e) => updateSurface(s.id, { material: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className={inputClass}
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSurface(s.id)
                    }}
                    className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-white/5"
                    aria-label="Remove surface"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
