import { Fragment, useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import type { SystemState, Surface } from '../types/system'
import { config } from '../config'

/** Optical glass materials with refractive index at 587.6 nm */
const MATERIAL_PRESETS: { name: string; n: number }[] = [
  { name: 'N-BK7', n: 1.5168 },
  { name: 'F2', n: 1.62 },
  { name: 'SF11', n: 1.7847 },
  { name: 'Fused Silica', n: 1.4585 },
  { name: 'Air', n: 1 },
]

/** Surface shape presets: radius (mm) and thickness (mm) */
const SURFACE_PRESETS: { name: string; radius: number; thickness: number }[] = [
  { name: 'Biconvex', radius: 100, thickness: 6 },
  { name: 'Plano-Convex', radius: 100, thickness: 5 },
  { name: 'Meniscus', radius: 70, thickness: 4 },
]

type SystemEditorProps = {
  systemState: SystemState
  onSystemStateChange: (state: SystemState | ((prev: SystemState) => SystemState)) => void
  onLoadComplete?: (fileName: string) => void
  selectedSurfaceId: string | null
  onSelectSurface: (id: string | null) => void
}

const inputClass =
  'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-cyan-electric/50 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] transition-shadow'

const numericInputClass =
  'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-cyan-electric/50 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] transition-shadow font-mono tabular-nums'

function MaterialCombobox({
  value,
  onChange,
  onClick,
}: {
  value: string
  onChange: (material: string, n?: number) => void
  onClick?: (e: React.MouseEvent) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? MATERIAL_PRESETS.filter((m) =>
        m.name.toLowerCase().includes(query.toLowerCase())
      )
    : MATERIAL_PRESETS

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (query.trim() && query !== value) {
          onChangeRef.current(query.trim())
        }
        setQuery('')
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [query, value])

  const handleSelect = (m: (typeof MATERIAL_PRESETS)[0]) => {
    onChange(m.name, m.n)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-0.5">
        <input
          type="text"
          value={isOpen ? query : value}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => {
            setQuery(value)
            setIsOpen(true)
          }}
          onClick={onClick}
          placeholder="Material..."
          className={inputClass}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen((o) => !o)
          }}
          className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-cyan-electric"
          aria-label="Toggle material list"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 mt-1 left-0 right-0 max-h-40 overflow-auto rounded border border-white/10 bg-slate-900 shadow-xl"
          >
            {filtered.length ? (
              filtered.map((m) => (
                <li key={m.name}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelect(m)
                    }}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-cyan-electric/20 text-slate-200"
                  >
                    {m.name} <span className="text-slate-500">(n={m.n})</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2 py-2 text-sm text-slate-500">No matches</li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function InsertBetweenRow({
  index,
  onInsert,
}: {
  index: number
  onInsert: (index: number) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <tr
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative border-0 bg-slate-900/20 backdrop-blur-[4px] hover:bg-slate-900/40 transition-colors"
    >
      <td colSpan={8} className="relative p-0 align-middle bg-slate-900/20 backdrop-blur-[4px]">
        <div className="relative flex items-center justify-center min-h-[12px] py-0.5">
          <AnimatePresence>
            {isHovered && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => {
                  e.stopPropagation()
                  onInsert(index)
                }}
                className="absolute z-10 flex items-center justify-center w-7 h-7 rounded-full bg-cyan-electric/90 text-slate-900 shadow-[0_0_12px_rgba(34,211,238,0.6)] hover:bg-cyan-electric hover:shadow-[0_0_16px_rgba(34,211,238,0.8)] transition-all"
                aria-label={`Insert surface at position ${index + 1}`}
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </td>
    </tr>
  )
}

export function SystemEditor({
  systemState,
  onSystemStateChange,
  onLoadComplete: _onLoadComplete, // Reserved for load/save design
  selectedSurfaceId,
  onSelectSurface,
}: SystemEditorProps) {
  const surfaces = systemState.surfaces

  const addSurfaceAtStart = () => addSurfaceAtIndex(0)

  const addSurfaceAtIndex = (index: number) => {
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
    onSystemStateChange((prev) => {
      const next = [...prev.surfaces]
      next.splice(index, 0, newSurface)
      return {
        ...prev,
        surfaces: next,
        traceResult: null,
        traceError: null,
      }
    })
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
      <div className="overflow-x-auto rounded-lg overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-400 border-b border-white/10 bg-slate-900/40 backdrop-blur-[4px]">
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
              className="border-b border-dashed border-white/20 cursor-pointer bg-slate-900/30 backdrop-blur-[4px] hover:bg-slate-900/50 text-slate-500 hover:text-cyan-electric transition-colors"
            >
              <td colSpan={8} className="py-2">
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Insert surface at start
                </span>
              </td>
            </tr>
            {surfaces.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && (
                  <InsertBetweenRow index={i} onInsert={addSurfaceAtIndex} />
                )}
                <tr
                onClick={() => onSelectSurface(s.id)}
                className={`border-b border-white/10 cursor-pointer transition-all bg-slate-900/30 backdrop-blur-[4px] ${
                  selectedSurfaceId === s.id
                    ? 'border-l-4 border-l-cyan-electric bg-slate-900/50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-900/50'
                }`}
              >
                <td className="py-2 pr-4 text-slate-400">{i + 1}</td>
                <td className="py-2 pr-4">
                  <div className="flex gap-1">
                    <select
                      value={s.type}
                      onChange={(e) => updateSurface(s.id, { type: e.target.value as 'Glass' | 'Air' })}
                      onClick={(e) => e.stopPropagation()}
                      className={inputClass}
                    >
                      <option value="Glass">Glass</option>
                      <option value="Air">Air</option>
                    </select>
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value
                        if (!v) return
                        e.target.value = ''
                        const preset = SURFACE_PRESETS.find((p) => p.name === v)
                        if (preset) {
                          updateSurface(s.id, {
                            type: 'Glass',
                            radius: preset.radius,
                            thickness: preset.thickness,
                          })
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`${inputClass} min-w-[7rem] text-slate-500`}
                      title="Quick Actions"
                    >
                      <option value="">Presets</option>
                      {SURFACE_PRESETS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.radius}
                    onChange={(e) => updateSurface(s.id, { radius: Number(e.target.value) || 0 })}
                    onClick={(e) => e.stopPropagation()}
                    className={numericInputClass}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.thickness}
                    onChange={(e) => updateSurface(s.id, { thickness: Number(e.target.value) || 0 })}
                    onClick={(e) => e.stopPropagation()}
                    className={numericInputClass}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.refractiveIndex}
                    onChange={(e) => updateSurface(s.id, { refractiveIndex: Number(e.target.value) || 1 })}
                    onClick={(e) => e.stopPropagation()}
                    className={numericInputClass}
                    step={0.01}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    value={s.diameter}
                    onChange={(e) => updateSurface(s.id, { diameter: Number(e.target.value) || 0 })}
                    onClick={(e) => e.stopPropagation()}
                    className={numericInputClass}
                  />
                </td>
                <td className="py-2 pr-4">
                  <MaterialCombobox
                    value={s.material}
                    onChange={(material, n) =>
                      updateSurface(s.id, {
                        material,
                        ...(n != null && { refractiveIndex: n }),
                        type: material === 'Air' ? 'Air' : 'Glass',
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
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
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
