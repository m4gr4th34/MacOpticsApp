import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MousePointer2,
  Zap,
  FileText,
  ScanLine,
  ChevronDown,
  Dices,
  Palette,
  Layers,
  BookOpen,
} from 'lucide-react'
import { isMac } from '../config'
import type { HighlightedMetric } from '../types/ui'
import type { SystemState } from '../types/system'
import { computePerformance } from '../types/system'

const kbdClass =
  'px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-200 font-mono text-[10px] shadow-[0_1px_0_0_rgba(255,255,255,0.1),inset_0_-1px_0_0_rgba(0,0,0,0.3)]'

const SECTIONS = [
  { id: 'nav', title: 'Navigation Shortcuts', icon: MousePointer2 },
  { id: 'lensx', title: 'Understanding Lens-X', icon: BookOpen },
  { id: 'laser', title: 'Laser & Gaussian Optics', icon: ScanLine },
  { id: 'coatings', title: 'Coatings & Reflectivity', icon: Layers },
  { id: 'ultrafast', title: 'Ultrafast / Femtosecond Design', icon: Zap },
  { id: 'chromatic', title: 'Chromatic Analysis & Optimization', icon: Palette },
  { id: 'montecarlo', title: 'Manufacturing Reliability (Monte Carlo)', icon: Dices },
  { id: 'export', title: 'Manufacturing Export', icon: FileText },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function AccordionItem({
  id,
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}: {
  id: SectionId
  title: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-white/5 transition-colors rounded-lg"
        aria-expanded={isOpen}
        aria-controls={`accordion-content-${id}`}
        id={`accordion-header-${id}`}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-5 h-5 text-cyan-electric shrink-0" strokeWidth={2} />
          <span className="font-semibold text-slate-200">{title}</span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-slate-400 shrink-0"
        >
          <ChevronDown className="w-5 h-5" strokeWidth={2} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`accordion-content-${id}`}
            key={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
            role="region"
            aria-labelledby={`accordion-header-${id}`}
          >
            <div className="px-4 pb-4 pt-0 text-slate-400 text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type GlossaryCardProps = {
  title: string
  explanation: string
  formula: string
  isHighlighted: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function GlossaryCard({
  title,
  explanation,
  formula,
  isHighlighted,
  onMouseEnter,
  onMouseLeave,
}: GlossaryCardProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`p-3 rounded-lg border transition-all duration-200 ${
        isHighlighted ? 'border-cyan-electric/60 bg-cyan-electric/5' : 'border-white/10 bg-white/5'
      }`}
    >
      <h4 className="font-medium text-cyan-electric text-sm mb-1">{title}</h4>
      <p className="text-slate-400 text-xs leading-relaxed mb-2">{explanation}</p>
      <code className="block font-mono text-xs text-slate-500 bg-black/20 rounded px-2 py-1 w-fit">
        {formula}
      </code>
    </div>
  )
}

const GLOSSARY_ITEMS: {
  title: string
  explanation: string
  formula: string
  metricId: Exclude<HighlightedMetric, null>
}[] = [
  { title: 'Z-Position', metricId: 'z', explanation: 'Axial distance from the global coordinate origin along the optical axis.', formula: 'z ∈ ℝ  (mm)' },
  { title: 'RMS Radius', metricId: 'rms', explanation: "Root mean square of ray distances from the centroid—effective 'blur' size.", formula: 'R_rms = √((1/n) Σ (y_i − ȳ)²)' },
  { title: 'Beam Width', metricId: 'beamWidth', explanation: 'Full aperture: total vertical spread of the ray bundle at the current Z-plane.', formula: 'W = max(yᵢ) − min(yᵢ)' },
  { title: 'Chief Ray Angle (CRA)', metricId: 'cra', explanation: 'Angle of the ray through the aperture stop center relative to the optical axis.', formula: 'CRA = arctan(dy/dz)  [°]' },
  {
    title: 'Spot Size (w₀) at focus',
    metricId: 'spotSize',
    explanation: 'Beam waist radius (1/e² radius) at the best focus. Derived from the on-axis RMS of ray intercepts.',
    formula: 'w₀ = 2 × R_rms  (1/e² radius = 2σ)',
  },
  {
    title: 'Rayleigh (z_R) at focus',
    metricId: 'rayleigh',
    explanation: 'Distance from the waist where the beam cross-section doubles. Uses M² from System Properties.',
    formula: 'z_R = π × w₀² / (λ × M²)  [mm]',
  },
]

function createLowDispersionPreset(): SystemState {
  const base: SystemState = {
    entrancePupilDiameter: 10,
    wavelengths: [587.6, 486.1, 656.3],
    fieldAngles: [0, 7, 14],
    numRays: 9,
    focusMode: 'On-Axis',
    m2Factor: 1.0,
    pulseWidthFs: 100,
    hasTraced: false,
    surfaces: [
      { id: crypto.randomUUID(), type: 'Glass', radius: 80, thickness: 6, refractiveIndex: 1.458, diameter: 25, material: 'Fused Silica', description: 'Low-dispersion front' },
      { id: crypto.randomUUID(), type: 'Air', radius: -80, thickness: 94, refractiveIndex: 1, diameter: 25, material: 'Air', description: 'Back surface' },
    ],
    rmsSpotRadius: 0,
    totalLength: 100,
    fNumber: 10,
    traceResult: null,
    traceError: null,
  }
  return { ...base, ...computePerformance(base) }
}

type InfoPanelProps = {
  highlightedMetric: HighlightedMetric
  onHighlightMetric: (m: HighlightedMetric) => void
  onSystemStateChange?: (state: SystemState | ((prev: SystemState) => SystemState)) => void
  onRunSampleAnalysis?: () => void
  onOpenOptimizer?: () => void
}

export function InfoPanel({ highlightedMetric, onHighlightMetric, onSystemStateChange, onRunSampleAnalysis, onOpenOptimizer }: InfoPanelProps) {
  const [openSection, setOpenSection] = useState<SectionId | null>('nav')

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 pb-8">
        <div className="bg-slate-900/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-xl">
          <div className="px-4 py-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-cyan-electric">User Guide</h2>
            <p className="text-slate-400 text-xs mt-0.5">Documentation for optical design workflows</p>
          </div>
          <div className="p-2">
            {SECTIONS.map(({ id, title, icon }) => (
              <AccordionItem
                key={id}
                id={id}
                title={title}
                icon={icon}
                isOpen={openSection === id}
                onToggle={() => setOpenSection((s) => (s === id ? null : id))}
              >
                {id === 'nav' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-slate-300 font-medium text-xs uppercase tracking-wider mb-2">Keyboard shortcuts</h4>
                      <ul className="space-y-2 text-slate-400">
                        <li className="flex items-center gap-2"><kbd className={kbdClass}>Space</kbd>+<kbd className={kbdClass}>Drag</kbd><span className="text-slate-500">— Pan viewport</span></li>
                        <li className="flex items-center gap-2"><kbd className={kbdClass}>Scroll</kbd><span className="text-slate-500">— Zoom in/out</span></li>
                        <li className="flex items-center gap-2"><kbd className={kbdClass}>Double Click</kbd><span className="text-slate-500">— Reset view</span></li>
                        <li className="flex items-center gap-2"><kbd className={kbdClass}>{isMac ? '⌥ Option' : 'Alt'}</kbd><span className="text-slate-500">— Override Snap-to-Focus</span></li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-slate-300 font-medium text-xs uppercase tracking-wider mb-2">Scan line</h4>
                      <p>Drag the scan line in the viewport to sweep Z and inspect RMS, beam width, and CRA. Use Snap to Focus / Snap to Surface to jump to key positions.</p>
                    </div>
                    <div>
                      <h4 className="text-slate-300 font-medium text-xs uppercase tracking-wider mb-2">HUD &amp; metrics</h4>
                      <p>Hover glossary cards in this guide to highlight the corresponding metric in the viewport HUD.</p>
                    </div>
                  </div>
                )}
                {id === 'laser' && (
                  <div className="space-y-4">
                    <p>Laser systems typically use Gaussian or near-Gaussian beam profiles. The scan metrics help you locate the beam waist, minimize spot size, and control divergence.</p>
                    <p>The HUD now displays Beam Waist (w₀) and Rayleigh Range (z<sub>R</sub>). For laser design, ensure your M² factor is set in System Properties to simulate real-world beam quality.</p>
                    <div className="space-y-2">
                      {GLOSSARY_ITEMS.map((item) => (
                        <GlossaryCard key={item.title} {...item} isHighlighted={highlightedMetric === item.metricId} onMouseEnter={() => onHighlightMetric(item.metricId)} onMouseLeave={() => onHighlightMetric(null)} />
                      ))}
                    </div>
                    <p><strong className="text-slate-300">Tip:</strong> Minimize RMS at the image plane to reduce blur; use the scan line to find where beam width is smallest.</p>
                    <div className="rounded-lg border border-cyan-electric/50 bg-cyan-electric/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-cyan-electric/90 mb-0.5">Pro-Tip</p>
                      <p className="text-slate-400 text-sm leading-relaxed">Note: The Gold Diamond indicates the point of minimum beam waist, which may shift based on lens dispersion.</p>
                    </div>
                  </div>
                )}
                {id === 'lensx' && (
                  <div className="space-y-4">
                    <h4 className="text-slate-300 font-medium text-xs uppercase tracking-wider">
                      Physics-Aware Interchange Format
                    </h4>
                    <p>
                      MacOptics uses a <strong className="text-cyan-electric">Physics-Aware</strong> format called <strong className="text-slate-300">Lens-X</strong>. Unlike a simple drawing file, Lens-X carries <strong className="text-slate-300">glass chemistry</strong> (Sellmeier coefficients for n(λ)) and <strong className="text-slate-300">coating data</strong> within the file itself.
                    </p>
                    <p>
                      When you export a design, the JSON includes radius, thickness, material, coating, and manufacturing tolerances for every surface. When you import, the software restores the full optical model—no manual re-entry of refractive indices or coating choices.
                    </p>
                    <div className="rounded-lg border border-cyan-electric/50 bg-cyan-electric/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-cyan-electric/90 mb-0.5">Why it matters</p>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        A Lens-X file is a Digital Twin: the same data drives ray tracing, chromatic analysis, and manufacturing export. Share a single JSON to hand off a complete, executable specification.
                      </p>
                    </div>
                  </div>
                )}
                {id === 'coatings' && (
                  <div className="space-y-4">
                    <h4 className="text-slate-300 font-medium text-xs uppercase tracking-wider">
                      Reflectivity Curve R(λ)
                    </h4>
                    <p>
                      When you <strong className="text-slate-300">hover over a coating option</strong> in the System Editor (e.g. BBAR, MgF₂, V-Coat 532), a small graph appears showing its reflectivity R(λ) across the wavelength range.
                    </p>
                    <p>
                      A <strong className="text-cyan-electric">vertical dashed line</strong> marks your system&apos;s current operating wavelength. Use it to verify that your chosen coating is effective at your design color—for AR coatings, lower R at your wavelength means less power loss.
                    </p>
                    <div className="rounded-lg border border-cyan-electric/50 bg-cyan-electric/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-cyan-electric/90 mb-0.5">Tip</p>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        V-Coat 532 is optimized for 532 nm; BBAR is broadband (400–700 nm). HR coatings reflect instead of refract—the ray follows the reflected path.
                      </p>
                    </div>
                  </div>
                )}
                {id === 'ultrafast' && (
                  <div className="space-y-4">
                    <p>Ultrafast and femtosecond optics introduce dispersion, group delay, and pulse broadening. This app models chromatic dispersion and thermal lensing to support pulsed-laser system design.</p>
                    <p>Designing for femtosecond pulses? Monitor the <strong className="text-slate-300">GDD</strong> (Group Delay Dispersion) value in the HUD. Most common glasses add positive GDD, which stretches your pulse. Aim for zero net GDD for transform-limited pulses.</p>
                    <ul className="space-y-1.5">
                      <li>• <strong className="text-slate-300">Dispersion</strong> — wavelength-dependent refractive index (Abbe V) affects pulse temporal shape</li>
                      <li>• <strong className="text-slate-300">Thermal lensing</strong> — absorption + dn/dT cause focal shift at high power (use Heat Map in System Properties)</li>
                      <li>• <strong className="text-slate-300">Ultrafast HUD</strong> — view GDD and pulse metrics when the scan line is active</li>
                    </ul>
                    {onSystemStateChange && (
                      <button type="button" onClick={() => onSystemStateChange(createLowDispersionPreset())} className="mt-2 px-3 py-2 rounded-lg text-sm font-medium text-cyan-electric border border-cyan-electric/50 hover:bg-cyan-electric/10 transition-colors">
                        Load Low-Dispersion Presets
                      </button>
                    )}
                  </div>
                )}
                {id === 'chromatic' && (
                  <div className="space-y-4">
                    <h4 className="text-slate-300 font-medium text-xs uppercase tracking-wider">
                      Chromatic Control &amp; Color Correction
                    </h4>
                    <p className="text-slate-500 text-xs italic">Managing focal shift across the visible and IR spectrum.</p>
                    <p>
                      <strong className="text-slate-300">Longitudinal Chromatic Aberration (LCA):</strong> Different colors of light refract at different angles because the refractive index n is a function of wavelength λ. The LCA graph plots the focus shift (Δz) relative to your design wavelength.
                    </p>
                    <p>
                      <strong className="text-slate-300">Reading the Graph:</strong> A steep vertical line indicates high dispersion (common in single-lens systems). A &quot;folded&quot; or flatter curve indicates an Achromatic design, where multiple wavelengths share a common focus.
                    </p>
                    <p>
                      <strong className="text-slate-300">One-Click Optimization:</strong> The Optimize Colors tool uses a heuristic search through the Schott and Ohara glass catalogs. It identifies the ideal &quot;Flint&quot; glass to pair with your current &quot;Crown&quot; glass to neutralize dispersion without changing your effective focal length.
                    </p>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Legend</p>
                      <ul className="space-y-1 text-slate-400 text-xs">
                        <li><kbd className={kbdClass}>Y-Axis</kbd> = Wavelength (λ)</li>
                        <li><kbd className={kbdClass}>X-Axis</kbd> = Focus Shift (Δz)</li>
                      </ul>
                      <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                        The zero-point on the X-axis represents the focus position of your primary system wavelength.
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2.5">
                      <p className="text-xs font-medium text-slate-400 mb-0.5">Tech Note</p>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        Note: Optimization requires a multi-surface system. For best results, use a doublet configuration (two lenses with different glass types).
                      </p>
                    </div>
                    {onOpenOptimizer && (
                      <button
                        type="button"
                        onClick={onOpenOptimizer}
                        title="Click the gradient button in the viewport HUD to run the glass-pairing algorithm."
                        className="w-full mt-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 transition-colors"
                      >
                        Open Optimizer
                      </button>
                    )}
                  </div>
                )}
                {id === 'montecarlo' && (
                  <div className="space-y-4">
                    <p>Monte Carlo sensitivity analysis simulates manufacturing variability by jittering surface parameters (radius, thickness) within their tolerances over many iterations. Each iteration produces a slightly different optical system; the combined spot positions at the image plane form a point cloud that shows how robust your design is to fabrication errors.</p>
                    <div className="rounded-lg border border-cyan-electric/50 bg-cyan-electric/5 px-3 py-2.5">
                      <p className="text-xs font-medium text-cyan-electric/90 mb-1">RMS Spot Radius</p>
                      <p className="text-slate-400 text-sm leading-relaxed">The root-mean-square distance of all rays from the centroid at the image plane. Lower values indicate tighter manufacturing tolerance and a more robust design.</p>
                    </div>
                    <p>Set R±, T±, and Tilt± tolerances in the System Editor, then run the analysis to see the point cloud and RMS spread at focus.</p>
                    {onRunSampleAnalysis && (
                      <button type="button" onClick={onRunSampleAnalysis} className="mt-2 px-3 py-2 rounded-lg text-sm font-medium text-cyan-electric border border-cyan-electric/50 hover:bg-cyan-electric/10 transition-colors">
                        Run Sample Analysis
                      </button>
                    )}
                  </div>
                )}
                {id === 'export' && (
                  <div className="space-y-4">
                    <p>Export your optical system as an ISO 10110–style technical drawing for manufacturing and documentation.</p>
                    <ul className="space-y-1.5">
                      <li>• <strong className="text-slate-300">Export tab</strong> — cross-section, dimensions (CT), data table (Surf, S/D, Material, CT), and title block</li>
                      <li>• <strong className="text-slate-300">S/D (Scratch/Dig)</strong> — surface quality per ISO 10110; editable in System Editor</li>
                      <li>• <strong className="text-slate-300">SVG / PDF</strong> — high-resolution export via Export Drawing and browser print</li>
                    </ul>
                  </div>
                )}
              </AccordionItem>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
