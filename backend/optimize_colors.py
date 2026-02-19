"""
Optimize glass pairing for doublet: minimize Longitudinal Chromatic Aberration (LCA)
between 486 nm and 656 nm. Returns recommended second glass and estimated LCA reduction.
"""

import numpy as np
from typing import Dict, List, Optional, Any

from trace_service import optical_stack_to_surf_data
from glass_materials import (
    get_all_materials,
    refractive_index_at_wavelength,
    get_material_by_name,
)


def _bfl_at_wavelength(
    surf_data_list: List[List[float]],
    wvl_nm: float,
    epd: float = 10.0,
    surface_diameters: Optional[List[float]] = None,
) -> float:
    """Compute BFL (mm) for given surface data at wavelength."""
    from singlet_rayoptics import build_singlet_from_surface_data, get_focal_length

    n_surf = len(surf_data_list)
    if surface_diameters is None:
        surface_diameters = [25.0] * (n_surf + 1)
    while len(surface_diameters) < n_surf + 1:
        surface_diameters.append(surface_diameters[-1] if surface_diameters else 25.0)

    try:
        opt_model = build_singlet_from_surface_data(
            surf_data_list,
            wvl_nm=wvl_nm,
            radius_mode=False,
            object_distance=1e10,
            epd=epd,
            surface_diameters=surface_diameters,
        )
        opt_model.update_model()
        opt_model.optical_spec.update_optical_properties()
        _, fod = get_focal_length(opt_model)
        if fod and np.isfinite(fod.bfl):
            return float(fod.bfl)
    except Exception:
        pass
    return float("nan")


def _doublet_surf_data(
    s1: Dict[str, Any],
    s2_air: Dict[str, Any],
    second_glass: str,
    t2: float,
    c3: float,
    wvl_nm: float = 587.6,
) -> List[List[float]]:
    """
    Build doublet surface data: [lens1 front], [cemented + lens2], [lens2 back].
    s1: first lens surface (glass), s2_air: original air gap surface.
    """
    r1 = float(s1.get("radius", 0) or 0)
    t1 = float(s1.get("thickness", 0) or 0)
    mat1 = s1.get("material") or ""
    n1_fb = float(s1.get("refractiveIndex", 1.5) or 1.5)
    n1 = refractive_index_at_wavelength(wvl_nm, mat1, n1_fb)

    r2 = float(s2_air.get("radius", 0) or 0)
    t3 = float(s2_air.get("thickness", 0) or 0)
    n2 = refractive_index_at_wavelength(wvl_nm, second_glass, 1.5)

    c1 = 1.0 / r1 if r1 != 0 else 0.0
    c2 = 1.0 / r2 if r2 != 0 else 0.0

    v1 = 64.2 if n1 > 1.01 else 0.0
    v2 = 64.2 if n2 > 1.01 else 0.0

    return [
        [c1, t1, n1, v1],
        [c2, t2, n2, v2],
        [c3, t3, 1.0, 0.0],
    ]


def _lca_for_doublet(
    optical_stack: dict,
    second_glass: str,
    t2: float,
    c3: float,
    wvl_nm: float = 587.6,
) -> float:
    """LCA = |BFL(486) - BFL(656)| for doublet with given second glass and geometry."""
    surfaces = optical_stack.get("surfaces", [])
    if len(surfaces) < 2:
        return float("inf")
    epd = float(optical_stack.get("entrancePupilDiameter", 10) or 10)
    diams = [float(s.get("diameter", 25) or 25) for s in surfaces]
    surf_data = _doublet_surf_data(surfaces[0], surfaces[1], second_glass, t2, c3, wvl_nm)
    surface_diameters = [diams[0], diams[0], diams[1] if len(diams) > 1 else diams[0]]

    bfl_486 = _bfl_at_wavelength(surf_data, 486.0, epd, surface_diameters)
    bfl_656 = _bfl_at_wavelength(surf_data, 656.0, epd, surface_diameters)
    if not (np.isfinite(bfl_486) and np.isfinite(bfl_656)):
        return float("inf")
    return abs(bfl_486 - bfl_656)


def run_optimize_colors(optical_stack: dict) -> dict:
    """
    Run local search over glass library to find second glass that minimizes LCA
    (BFL_max - BFL_min) between 486 nm and 656 nm in a doublet configuration.

    Returns: { recommended_glass: str, estimated_lca_reduction: float }
    """
    surfaces = optical_stack.get("surfaces", [])
    if len(surfaces) < 2:
        return {"recommended_glass": "", "estimated_lca_reduction": 0.0}

    s1 = surfaces[0]
    s2 = surfaces[1]
    mat1 = (s1.get("material") or "").strip()
    if not mat1 or mat1.lower() == "air":
        return {"recommended_glass": "", "estimated_lca_reduction": 0.0}

    epd = float(optical_stack.get("entrancePupilDiameter", 10) or 10)
    wvl_nm = float(optical_stack.get("wavelengths", [587.6])[0] or 587.6)
    diams = [float(s.get("diameter", 25) or 25) for s in surfaces]

    surf_data_singlet = optical_stack_to_surf_data(surfaces, wvl_nm=wvl_nm)
    surface_diameters = diams + [diams[-1]] if len(diams) < 3 else diams[:3]

    bfl_486_s = _bfl_at_wavelength(surf_data_singlet, 486.0, epd, surface_diameters)
    bfl_656_s = _bfl_at_wavelength(surf_data_singlet, 656.0, epd, surface_diameters)
    if not (np.isfinite(bfl_486_s) and np.isfinite(bfl_656_s)):
        return {"recommended_glass": "", "estimated_lca_reduction": 0.0}

    lca_singlet = abs(bfl_486_s - bfl_656_s)

    materials = get_all_materials()
    candidates = [
        m for m in materials
        if m.get("name") and m.get("name").lower() != "air"
        and m.get("name").lower() != mat1.lower()
    ]

    t1 = float(s1.get("thickness", 5) or 5)
    t2 = t1 * 0.5
    r2 = float(s2.get("radius", 0) or 0)
    c2 = 1.0 / r2 if r2 != 0 else 0.0

    best_glass = ""
    best_lca = float("inf")

    c3_range = np.linspace(c2 - 0.03, c2 + 0.03, 15)

    for m in candidates:
        glass_name = m.get("name", "")
        if not glass_name:
            continue
        mat = get_material_by_name(glass_name)
        if not mat or mat.get("dispersion_formula") != "sellmeier":
            continue
        for c3 in c3_range:
            lca = _lca_for_doublet(optical_stack, glass_name, t2, float(c3), wvl_nm)
            if lca < best_lca:
                best_lca = lca
                best_glass = glass_name

    if not best_glass:
        return {"recommended_glass": "", "estimated_lca_reduction": 0.0}

    reduction = max(0.0, lca_singlet - best_lca)
    return {
        "recommended_glass": best_glass,
        "estimated_lca_reduction": round(reduction, 6),
    }
