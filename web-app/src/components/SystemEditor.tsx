import { Plus, Trash2 } from 'lucide-react'
import type { SystemState, Surface } from '../types/system'

type SystemEditorProps = {
  systemState: SystemState
  onSystemStateChange: (state: SystemState | ((prev: SystemState) => SystemState)) => void
}

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-electric/50'

function createSurface(id: string): Surface {
  return {
    id,
    type: 'Glass',
    radius: 100,
    thickness: 5,
    refractiveIndex: 1.5168,
    diameter: 25,
    material: 'N-BK7',
    description: '',
  }
}

export function SystemEditor({ systemState, onSystemStateChange }: SystemEditorProps) {
  const surfaces = systemState.surfaces

  const updateSurface = (index: number, partial: Partial<Surface>) => {
    onSystemStateChange((prev) => {
      let next = { ...prev.surfaces[index], ...partial }
      if ('material' in partial) {
        const m = String(partial.material ?? '').trim().toLowerCase()
        if (m === 'air') {
          next = { ...next, type: 'Air', refractiveIndex: 1 }
        } else if (m && next.type === 'Air') {
          next = { ...next, type: 'Glass', refractiveIndex: 1.5168 }
        }
      }
      return {
        ...prev,
        surfaces: prev.surfaces.map((s, i) => (i === index ? next : s)),
      }
    })
  }

  const removeSurface = (index: number) => {
    if (surfaces.length <= 1) return
    onSystemStateChange((prev) => ({
      ...prev,
      surfaces: prev.surfaces.filter((_, i) => i !== index),
    }))
  }

  const addSurface = () => {
    const mid = Math.floor(surfaces.length / 2)
    const newSurface = createSurface(
      `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    )
    onSystemStateChange((prev) => ({
      ...prev,
      surfaces: [
        ...prev.surfaces.slice(0, mid),
        newSurface,
        ...prev.surfaces.slice(mid),
      ],
    }))
  }

  const columns = [
    { key: 'num', label: '#', width: 'w-12' },
    { key: 'radius', label: 'Radius (mm)', width: 'w-24' },
    { key: 'thickness', label: 'Thickness (mm)', width: 'w-28' },
    { key: 'material', label: 'Glass/Material', width: 'w-32' },
    { key: 'diameter', label: 'Diameter (mm)', width: 'w-24' },
    { key: 'description', label: 'Description', width: 'flex-1' },
    { key: 'actions', label: '', width: 'w-12' },
  ] as const

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-cyan-electric font-semibold text-lg">
          Optical Stack
        </h2>
        <button
          onClick={addSurface}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            background: 'linear-gradient(135deg, #22D3EE 0%, #0891b2 100%)',
            color: '#0B1120',
            boxShadow: '0 0 24px rgba(34, 211, 238, 0.3)',
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={2} />
          New Surface
        </button>
      </div>

      <div className="glass-card overflow-hidden flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-midnight/95 backdrop-blur border-b border-white/10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.width} px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {surfaces.map((s, i) => (
                <tr
                  key={s.id}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-400 font-mono text-sm">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={s.radius}
                      onChange={(e) =>
                        updateSurface(i, {
                          radius: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClass}
                      step={1}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={s.thickness}
                      onChange={(e) =>
                        updateSurface(i, {
                          thickness: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClass}
                      min={0}
                      step={0.1}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={s.material}
                      onChange={(e) =>
                        updateSurface(i, { material: e.target.value })
                      }
                      className={inputClass}
                      placeholder="N-BK7, Air..."
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={s.diameter}
                      onChange={(e) =>
                        updateSurface(i, {
                          diameter: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClass}
                      min={0}
                      step={0.5}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={s.description}
                      onChange={(e) =>
                        updateSurface(i, { description: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Optional notes..."
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeSurface(i)}
                      disabled={surfaces.length <= 1}
                      className="p-2 rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-500"
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
    </div>
  )
}
