/**
 * Material name -> refractive index (n) at d-line 587.6 nm.
 * Used for Material/Index column in System Editor.
 */
export const MATERIAL_INDEX: Record<string, number> = {
  air: 1.0,
  vacuum: 1.0,
  'n-bk7': 1.5168,
  bk7: 1.5168,
  nbk7: 1.5168,
  'n-sf11': 1.78472,
  sf11: 1.78472,
  'fused silica': 1.458,
  'fused-silica': 1.458,
  silica: 1.458,
  sapphire: 1.77,
  'sf5': 1.6727,
  'n-sf5': 1.6727,
  'sf10': 1.7283,
  'n-sf10': 1.7283,
  'baf10': 1.67,
  'n-baf10': 1.67,
  'lak9': 1.691,
  'n-lak9': 1.691,
}

/** Canonical display names for known materials */
export const MATERIAL_DISPLAY: Record<string, string> = {
  '1': 'Air',
  '1.0': 'Air',
  '1.5168': 'N-BK7',
  '1.78472': 'N-SF11',
  '1.458': 'Fused Silica',
  '1.77': 'Sapphire',
  '1.6727': 'N-SF5',
  '1.7283': 'N-SF10',
  '1.67': 'N-BAF10',
  '1.691': 'N-LAK9',
}

export type MaterialParseResult = {
  refractiveIndex: number
  material: string
  type: 'Glass' | 'Air'
}

/**
 * Parse Material/Index input: number (n) or material name.
 * Returns refractiveIndex, material display string, and type.
 */
export function parseMaterialIndex(input: string): MaterialParseResult {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) {
    return { refractiveIndex: 1, material: 'Air', type: 'Air' }
  }
  const lower = trimmed.toLowerCase()
  if (MATERIAL_INDEX[lower] != null) {
    const n = MATERIAL_INDEX[lower]
    const display = n === 1 ? 'Air' : trimmed
    return {
      refractiveIndex: n,
      material: display,
      type: n > 1.01 ? 'Glass' : 'Air',
    }
  }
  const num = parseFloat(trimmed)
  if (!Number.isNaN(num) && num >= 1 && num < 3) {
    const display = MATERIAL_DISPLAY[String(num)] ?? `n=${num.toFixed(4)}`
    return {
      refractiveIndex: num,
      material: display,
      type: num > 1.01 ? 'Glass' : 'Air',
    }
  }
  return { refractiveIndex: 1, material: 'Air', type: 'Air' }
}

/** Format refractiveIndex for display in Material/Index field */
export function formatMaterialIndex(material: string, refractiveIndex: number): string {
  if (refractiveIndex <= 1.001) return 'Air'
  const key = String(refractiveIndex)
  if (MATERIAL_DISPLAY[key]) return MATERIAL_DISPLAY[key]
  if (material && material !== `n=${refractiveIndex}`) return material
  return `n=${refractiveIndex.toFixed(4)}`
}

/** Presets for Material dropdown */
export const MATERIAL_PRESETS = [
  { value: 'air', label: 'Air (1.0)', n: 1.0 },
  { value: 'bk7', label: 'BK7 (1.517)', n: 1.5168 },
  { value: 'sf11', label: 'SF11 (1.785)', n: 1.78472 },
] as const

const PRESET_TOLERANCE = 0.0005

/** Get preset value that matches refractiveIndex, or 'custom' */
export function getPresetForIndex(n: number): 'air' | 'bk7' | 'sf11' | 'custom' {
  for (const p of MATERIAL_PRESETS) {
    if (Math.abs(n - p.n) < PRESET_TOLERANCE) return p.value
  }
  return 'custom'
}

/** Get refractive index for preset value */
export function getIndexForPreset(value: string): number {
  const p = MATERIAL_PRESETS.find((x) => x.value === value)
  return p ? p.n : 1.5
}
