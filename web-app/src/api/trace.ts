/**
 * API client for optical trace backend.
 * Sends optical_stack, receives (z,y) ray and surface coordinates.
 */

export type TraceResponse = {
  rays?: number[][][]  // [[[z,y], ...], ...] per ray
  surfaces?: number[][][]  // [[[z,y], ...], ...] per surface curve
  focusZ?: number
  zOrigin?: number
  performance?: {
    rmsSpotRadius: number
    totalLength: number
    fNumber: number
  }
  error?: string
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function traceOpticalStack(opticalStack: {
  surfaces: Array<{
    id?: string
    type: string
    radius: number
    thickness: number
    refractiveIndex: number
    diameter?: number
    material?: string
    description?: string
  }>
  entrancePupilDiameter: number
  wavelengths: number[]
  fieldAngles: number[]
  numRays: number
}): Promise<TraceResponse> {
  const res = await fetch(`${API_BASE}/api/trace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opticalStack),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Trace failed: ${res.status}`)
  }
  return res.json()
}
