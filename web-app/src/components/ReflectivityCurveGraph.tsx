/**
 * Small R(λ) reflectivity curve graph for coating preview.
 * Highlights system wavelength with vertical dashed line.
 */

import type { ReflectivityPoint } from '../api/coatings'

const W = 180
const H = 80
const PAD = { left: 36, right: 8, top: 6, bottom: 24 }

type Props = {
  points: ReflectivityPoint[]
  /** System operating wavelength (nm) — vertical dashed line */
  systemWavelengthNm: number
  /** Wavelength range for axis labels */
  minNm: number
  maxNm: number
  coatingName?: string
  className?: string
}

export function ReflectivityCurveGraph({
  points,
  systemWavelengthNm,
  minNm,
  maxNm,
  coatingName,
  className = '',
}: Props) {
  if (!points.length) return null

  const xMin = minNm
  const xMax = maxNm
  const xRange = xMax - xMin || 1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const toX = (lam: number) => PAD.left + ((lam - xMin) / xRange) * plotW

  const maxR = Math.max(...points.map((p) => p.reflectivity), 0.01)
  const rScale = Math.min(1, maxR * 1.2)

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.wavelength)} ${PAD.top + plotH - (p.reflectivity / rScale) * plotH}`)
    .join(' ')

  const sysX = toX(systemWavelengthNm)
  const inRange = systemWavelengthNm >= xMin && systemWavelengthNm <= xMax

  const closest = points.reduce((a, b) =>
    Math.abs(a.wavelength - systemWavelengthNm) <= Math.abs(b.wavelength - systemWavelengthNm) ? a : b
  )
  const sysR = closest.reflectivity

  return (
    <div className={className}>
      {coatingName && (
        <div className="text-[10px] font-medium text-slate-300 mb-0.5 truncate" title={coatingName}>
          {coatingName}
        </div>
      )}
      <svg width={W} height={H} className="block" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="reflectivityGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#334155" strokeWidth="0.5" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#334155" strokeWidth="0.5" />
        {/* Axis labels */}
        <text x={PAD.left - 4} y={PAD.top + 4} className="fill-slate-500" fontSize="8" textAnchor="end">
          R
        </text>
        <text x={PAD.left} y={H - 4} className="fill-slate-500" fontSize="8" textAnchor="middle">
          {xMin}
        </text>
        <text x={W - PAD.right} y={H - 4} className="fill-slate-500" fontSize="8" textAnchor="middle">
          {xMax}
        </text>
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 4} className="fill-slate-500" fontSize="8" textAnchor="middle">
          λ (nm)
        </text>
        {/* System wavelength vertical line */}
        {inRange && (
          <line
            x1={sysX}
            y1={PAD.top}
            x2={sysX}
            y2={H - PAD.bottom}
            stroke="#22d3ee"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity={0.8}
          />
        )}
        {/* Curve area fill */}
        <path
          d={`${pathD} L ${toX(points[points.length - 1].wavelength)} ${H - PAD.bottom} L ${toX(points[0].wavelength)} ${H - PAD.bottom} Z`}
          fill="url(#reflectivityGrad)"
        />
        {/* Curve line */}
        <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* System wavelength label */}
        {inRange && (
          <g>
            <circle cx={sysX} cy={PAD.top + plotH - (sysR / rScale) * plotH} r="2.5" fill="#22d3ee" />
            <text
              x={sysX}
              y={PAD.top - 2}
              className="fill-cyan-electric"
              fontSize="7"
              textAnchor="middle"
              fontWeight="600"
            >
              {systemWavelengthNm} nm
            </text>
            <text
              x={sysX + 2}
              y={PAD.top + plotH - (sysR / rScale) * plotH}
              className="fill-slate-300"
              fontSize="7"
              textAnchor="start"
            >
              R={(sysR * 100).toFixed(2)}%
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
