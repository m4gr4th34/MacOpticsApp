"""
ABCD matrix method for Gaussian beam propagation through optical systems.
Computes beam waist, Rayleigh range, and 1/e² envelope for visualization.
"""

from typing import Optional
import numpy as np


def _abcd_propagate(q_in: complex, a: float, b: float, c: float, d: float) -> complex:
    """Propagate complex beam parameter: q_out = (A*q_in + B) / (C*q_in + D)"""
    denom = c * q_in + d
    if abs(denom) < 1e-20:
        return np.inf + 0j  # avoid division by zero
    return (a * q_in + b) / denom


def _q_to_waist_rayleigh(q: complex, wvl_mm: float) -> tuple[float, float]:
    """
    At beam waist: q = j*z_R (pure imaginary), so z_R = Im(q), w0² = λ*z_R/π.
    Returns (w0, z_R) in mm.
    """
    if abs(q) > 1e10:
        return 0.0, 0.0
    z_r = q.imag
    if z_r <= 0:
        return 0.0, 0.0
    w0_sq = wvl_mm * z_r / np.pi
    w0 = float(np.sqrt(w0_sq))
    return w0, float(z_r)


def _beam_radius_from_q(q: complex, wvl_mm: float) -> float:
    """Beam radius w (1/e²) from q: w² = λ/π * |q|² / Im(q) for Im(q) > 0."""
    if abs(q) < 1e-20 or q.imag <= 0:
        return 0.0
    denom = np.pi * q.imag
    w_sq = wvl_mm * (q.real**2 + q.imag**2) / denom
    return float(np.sqrt(max(0, w_sq)))


def _beam_radius_at_z(w0: float, z_r: float, z_from_waist: float) -> float:
    """1/e² beam radius at distance z from waist: w(z) = w0 * sqrt(1 + (z/z_R)²)"""
    return w0 * np.sqrt(1.0 + (z_from_waist / z_r) ** 2)


def compute_gaussian_beam(
    surf_data_list: list,
    epd_mm: float,
    wvl_nm: float,
    m2: float = 1.0,
    n_samples: int = 100,
    focus_z_override: Optional[float] = None,
) -> dict:
    """
    Propagate Gaussian beam through optical system using ABCD matrices.

    surf_data_list: [[curvature, thickness, n, v], ...] per surface
    epd_mm: entrance pupil diameter (mm)
    wvl_nm: wavelength (nm)
    m2: laser M² factor (default 1.0 for perfect Gaussian)

    Returns:
        beamEnvelope: [[z, w], ...] — axial position (mm) and 1/e² radius (mm)
        spotSizeAtFocus: w0 at focus (mm)
        rayleighRange: z_R at focus (mm)
        waistZ: axial position of beam waist (mm)
        focusZ: paraxial focus position (mm)
    """
    wvl_mm = wvl_nm * 1e-6
    w0_entrance = (epd_mm / 2.0) * 0.9  # effective waist at entrance (slightly smaller)
    z_r_entrance = np.pi * (w0_entrance ** 2) / (wvl_mm * m2)  # M²: z_R ∝ 1/M²
    q = 1j * z_r_entrance  # at waist, R=∞

    z_positions = [0.0]
    n_list = [1.0]

    for row in surf_data_list:
        curv, thick, n = float(row[0]), float(row[1]), float(row[2])
        n_list.append(n)

    # Build ABCD chain: object -> surf1 -> propagate -> surf2 -> propagate -> ...
    z_current = 0.0
    for i, row in enumerate(surf_data_list):
        curv, thick, n = float(row[0]), float(row[1]), float(row[2])
        n_before = n_list[i]
        n_after = n

        # Refraction at curved interface: C = (n_before - n_after) / (R * n_after), D = n_before / n_after
        # R = 1/curv (curvature in 1/mm)
        r_mm = 1.0 / curv if abs(curv) > 1e-12 else 1e6  # avoid div by zero for flat
        c_refract = (n_before - n_after) / (r_mm * n_after)
        d_refract = n_before / n_after
        a_refract, b_refract = 1.0, 0.0

        q = _abcd_propagate(q, a_refract, b_refract, c_refract, d_refract)
        if np.isinf(q):
            break

        # Propagate through thickness
        a_prop, b_prop = 1.0, thick
        c_prop, d_prop = 0.0, 1.0
        q = _abcd_propagate(q, a_prop, b_prop, c_prop, d_prop)
        z_current += thick

        z_positions.append(z_current)

    # Find waist position and paraxial focus
    if focus_z_override is not None and np.isfinite(focus_z_override):
        focus_z = float(focus_z_override)
    else:
        efl = _paraxial_efl(surf_data_list)
        if efl and np.isfinite(efl) and efl > 0:
            focus_z = z_current + efl
        else:
            focus_z = z_current + 50.0

    # Propagate q to focus plane to get waist there
    d_to_focus = focus_z - z_current
    a, b, c, d = 1.0, d_to_focus, 0.0, 1.0
    q_focus = _abcd_propagate(q, a, b, c, d)
    w0_focus, z_r_focus = _q_to_waist_rayleigh(q_focus, wvl_mm)

    if w0_focus <= 0 or z_r_focus <= 0:
        w0_focus = w0_entrance * 0.5
        z_r_focus = np.pi * (w0_focus ** 2) / (wvl_mm * m2)

    waist_z = focus_z

    # Build beam envelope: propagate q through system and sample w at each z
    envelope = []
    z_min = -50.0

    # Pre-focus: collimated expansion
    for z in np.linspace(z_min, 0, max(5, n_samples // 10)):
        w = _beam_radius_at_z(w0_entrance, z_r_entrance, -float(z))
        envelope.append([float(z), float(w)])

    # Through system: step-by-step propagation
    q_trace = 1j * z_r_entrance
    z_trace = 0.0
    n_list = [1.0] + [float(r[2]) for r in surf_data_list]

    for i, row in enumerate(surf_data_list):
        curv, thick, n = float(row[0]), float(row[1]), float(row[2])
        n_before, n_after = n_list[i], n_list[i + 1]
        r_mm = 1.0 / curv if abs(curv) > 1e-12 else 1e6
        c_r = (n_before - n_after) / (r_mm * n_after)
        q_trace = _abcd_propagate(q_trace, 1, 0, c_r, n_before / n_after)
        w_at_surf = _beam_radius_from_q(q_trace, wvl_mm)
        envelope.append([z_trace, w_at_surf])

        n_steps = max(3, int(thick / 2))
        for k in range(1, n_steps + 1):
            dz = thick * k / n_steps
            q_prop = _abcd_propagate(q_trace, 1, dz, 0, 1)
            w = _beam_radius_from_q(q_prop, wvl_mm)
            envelope.append([z_trace + dz, w])

        q_trace = _abcd_propagate(q_trace, 1, thick, 0, 1)
        z_trace += thick

    # Post-system to focus and beyond
    z_max = focus_z + 2 * z_r_focus
    for z in np.linspace(z_trace, z_max, n_samples):
        z_from_waist = z - waist_z
        w = _beam_radius_at_z(w0_focus, z_r_focus, z_from_waist)
        envelope.append([float(z), float(w)])

    envelope.sort(key=lambda p: p[0])

    return {
        "beamEnvelope": envelope,
        "spotSizeAtFocus": float(w0_focus),
        "rayleighRange": float(z_r_focus),
        "waistZ": float(waist_z),
        "focusZ": float(focus_z),
    }


def _paraxial_efl(surf_data_list: list) -> Optional[float]:
    """Approximate EFL using lensmaker's formula for thin lens."""
    if len(surf_data_list) < 2:
        return None
    r1 = 1.0 / surf_data_list[0][0] if abs(surf_data_list[0][0]) > 1e-12 else 1e6
    r2 = 1.0 / surf_data_list[1][0] if abs(surf_data_list[1][0]) > 1e-12 else 1e6
    n = surf_data_list[0][2]
    if abs(r1) < 1e-6 or abs(r2) < 1e-6:
        return None
    phi = (n - 1) * (1 / r1 - 1 / r2)
    if abs(phi) < 1e-12:
        return None
    return 1.0 / phi
