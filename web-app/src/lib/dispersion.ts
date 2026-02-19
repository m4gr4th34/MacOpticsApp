/**
 * Dispersion Analysis for ultrafast pulse design.
 * Sellmeier equation: n²(λ) = 1 + Σ Bᵢλ²/(λ² - Cᵢ)
 * λ in µm. GDD in fs², TOD in fs³.
 */

export type SellmeierCoeffs = { B: [number, number, number]; C: [number, number, number] }

/** Sellmeier coefficients (λ in µm). Sources: Schott, Malitson. */
export const SELLMEIER: Record<string, SellmeierCoeffs> = {
  'N-BK7': { B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
  'BK7': { B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
  'N-SF11': { B: [1.73848403, 0.31116824, 1.17490871], C: [0.0133711172, 0.0619001176, 121.419942] },
  'SF11': { B: [1.73848403, 0.31116824, 1.17490871], C: [0.0133711172, 0.0619001176, 121.419942] },
  'Fused Silica': { B: [0.6961663, 0.4079426, 0.8974794], C: [0.004679148, 0.01351206, 97.93432] },
  'Silica': { B: [0.6961663, 0.4079426, 0.8974794], C: [0.004679148, 0.01351206, 97.93432] },
  'F2': { B: [1.31038764, 0.196681836, 0.966129764], C: [0.00958633072, 0.0457627625, 99.2753302] },
  'N-SF5': { B: [1.31038764, 0.196681836, 0.966129764], C: [0.00958633072, 0.0457627625, 99.2753302] },
  'N-SF10': { B: [1.61625974, 0.259229334, 0.96887106], C: [0.0106200162, 0.0473625942, 119.248795] },
  'N-BAF10': { B: [1.5851495, 0.143571385, 1.08521269], C: [0.00909730952, 0.0424520636, 105.613573] },
  'N-LAK9': { B: [1.41673927, 0.126605356, 1.28217827], C: [0.00906333117, 0.0493226978, 95.6403971] },
}

/** Map material names (lowercase) to Sellmeier key */
const MATERIAL_TO_SELLMEIER: Record<string, string> = {
  'n-bk7': 'N-BK7', bk7: 'N-BK7', nbk7: 'N-BK7',
  'n-sf11': 'N-SF11', sf11: 'N-SF11',
  'fused silica': 'Fused Silica', 'fused-silica': 'Fused Silica', silica: 'Fused Silica',
  'f2': 'F2', 'n-sf5': 'N-SF5', 'n-sf10': 'N-SF10',
  'n-baf10': 'N-BAF10', baf10: 'N-BAF10',
  'n-lak9': 'N-LAK9', lak9: 'N-LAK9',
}

function getSellmeier(material: string): SellmeierCoeffs | null {
  const key = MATERIAL_TO_SELLMEIER[material.toLowerCase().trim()]
  return key ? SELLMEIER[key] ?? null : null
}

/** Refractive index from Sellmeier. λ_nm in nm. */
export function nFromSellmeier(lambdaNm: number, coeffs: SellmeierCoeffs): number {
  const lam = lambdaNm * 1e-3 // µm
  const lam2 = lam * lam
  let n2 = 1
  for (let i = 0; i < 3; i++) {
    n2 += (coeffs.B[i] * lam2) / (lam2 - coeffs.C[i])
  }
  return Math.sqrt(Math.max(n2, 1))
}

/** Fallback: use constant n for unknown materials */
export function refractiveIndexAtWavelength(lambdaNm: number, material: string, nDefault: number): number {
  const coeffs = getSellmeier(material)
  return coeffs ? nFromSellmeier(lambdaNm, coeffs) : nDefault
}

const DEL = 0.5 // nm for numerical derivatives (balance accuracy vs precision)

/** d²n/dλ² at λ (nm). Result in 1/nm². */
function d2n_dlambda2(lambdaNm: number, coeffs: SellmeierCoeffs): number {
  const n0 = nFromSellmeier(lambdaNm, coeffs)
  const nP = nFromSellmeier(lambdaNm + DEL, coeffs)
  const nM = nFromSellmeier(lambdaNm - DEL, coeffs)
  return (nP - 2 * n0 + nM) / (DEL * DEL)
}

/** d³n/dλ³ at λ (nm). Result in 1/nm³. */
function d3n_dlambda3(lambdaNm: number, coeffs: SellmeierCoeffs): number {
  const n2 = d2n_dlambda2(lambdaNm + DEL, coeffs)
  const n1 = d2n_dlambda2(lambdaNm - DEL, coeffs)
  return (n2 - n1) / (2 * DEL)
}

const C_LIGHT_MS = 2.99792458e8

/** GDD in fs² for path length L_mm (mm). λ in nm, d2n in 1/nm². */
export function gddFs2(lambdaNm: number, d2n_perNm2: number, L_mm: number): number {
  const lam_m = lambdaNm * 1e-9
  const d2n_perM2 = d2n_perNm2 * 1e18
  const c = C_LIGHT_MS
  const L = L_mm * 1e-3
  const gdd_s2 = (L * Math.pow(lam_m, 3) * d2n_perM2) / (2 * Math.PI * Math.PI * c * c)
  return gdd_s2 * 1e30 // s² → fs²
}

/** TOD in fs³ for path length L_mm. λ in nm, d2n in 1/nm², d3n in 1/nm³. */
export function todFs3(lambdaNm: number, d2n_perNm2: number, d3n_perNm3: number, L_mm: number): number {
  const lam_m = lambdaNm * 1e-9
  const d2n_perM2 = d2n_perNm2 * 1e18
  const d3n_perM3 = d3n_perNm3 * 1e27
  const c = C_LIGHT_MS
  const L = L_mm * 1e-3
  const term = lam_m * d3n_perM3 - 2 * d2n_perM2
  const tod_s3 = (L * Math.pow(lam_m, 4) * term) / (4 * Math.pow(Math.PI, 3) * Math.pow(c, 3))
  return tod_s3 * 1e45 // s³ → fs³
}

/** Gaussian pulse broadening: τ_out² ≈ τ_in² + (4 ln 2)² GDD²/τ_in² + (4 ln 2)³ TOD²/τ_in⁴ (approx) */
export function predictedExitPulseWidthFs(
  tauInFs: number,
  gddTotalFs2: number,
  todTotalFs3: number
): number {
  const a = 4 * Math.LN2
  const tau2 = tauInFs * tauInFs
  const gddTerm = (a * a * gddTotalFs2 * gddTotalFs2) / tau2
  const todTerm = (a * a * a * todTotalFs3 * todTotalFs3) / (tau2 * tau2)
  return Math.sqrt(Math.max(0, tau2 + gddTerm + todTerm))
}

export type SurfaceForDispersion = { thickness: number; material: string; type: string; refractiveIndex: number }

export type DispersionResult = {
  gddFs2: number
  todFs3: number
  predictedExitPulseWidthFs: number
}

export function computeDispersion(
  surfaces: SurfaceForDispersion[],
  lambdaNm: number,
  pulseWidthFs: number
): DispersionResult {
  let gddTotal = 0
  let todTotal = 0

  for (const s of surfaces) {
    if (s.type === 'Air' || s.refractiveIndex <= 1.01) continue
    const coeffs = getSellmeier(s.material)
    if (!coeffs) continue

    const L = s.thickness
    const d2n = d2n_dlambda2(lambdaNm, coeffs)
    const d3n = d3n_dlambda3(lambdaNm, coeffs)
    gddTotal += gddFs2(lambdaNm, d2n, L)
    todTotal += todFs3(lambdaNm, d2n, d3n, L)
  }

  const predExit = predictedExitPulseWidthFs(pulseWidthFs, gddTotal, todTotal)

  return {
    gddFs2: gddTotal,
    todFs3: todTotal,
    predictedExitPulseWidthFs: predExit,
  }
}
