/**
 * Import lens system from .json or .svg via /api/import/lens-system.
 *
 * DEVELOPER NOTE: Before making changes to import logic, read LENS_X_SPEC.md
 * in the project root. It is the ground truth for the Lens-X schema.
 */

import { config } from '../config'
import type { Surface } from '../types/system'

const API_BASE = config.apiBaseUrl

export interface ImportLensResponse {
  surfaces: Surface[]
}

export async function importLensSystem(file: File): Promise<ImportLensResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_BASE}/api/import/lens-system`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Import failed (${res.status})`)
  }

  const data = (await res.json()) as ImportLensResponse
  if (!Array.isArray(data.surfaces)) {
    throw new Error('Invalid response: expected surfaces array')
  }
  return data
}
