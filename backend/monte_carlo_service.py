"""
Monte Carlo sensitivity analysis: run N iterations with jittered surface parameters
within tolerance, return spot positions at image plane for point cloud visualization.
"""

import sys
import os
import random
import numpy as np

_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from trace_service import optical_stack_to_surf_data
from singlet_rayoptics import build_singlet_from_surface_data, get_focal_length, run_spot_diagram


def _jitter_surfaces(surfaces, rng=None):
    """
    Create a copy of surfaces with radius and thickness jittered within their tolerances.
    Uses uniform distribution in [-tolerance, +tolerance].
    Tilt tolerance is stored for future use (backend tilt support pending).
    """
    rng = rng or random.Random()
    jittered = []
    for s in surfaces:
        surf = dict(s)
        r_tol = float(s.get("radiusTolerance") or 0)
        t_tol = float(s.get("thicknessTolerance") or 0)
        if r_tol > 0:
            surf["radius"] = float(s["radius"]) + rng.uniform(-r_tol, r_tol)
        if t_tol > 0:
            surf["thickness"] = float(s["thickness"]) + rng.uniform(-t_tol, t_tol)
            surf["thickness"] = max(0.01, surf["thickness"])
        jittered.append(surf)
    return jittered


def run_monte_carlo(optical_stack: dict, iterations: int = 100) -> dict:
    """
    Run Monte Carlo sensitivity analysis.

    For each iteration:
      - Jitter radius and thickness for each surface within their tolerances
      - Build optical model and run spot diagram
      - Collect spot (x,y) positions at image plane for all rays

    Returns:
        spots: list of [x, y] in mm at image plane (one per ray per iteration)
        focusZ: nominal focus Z (mm), relative to zOrigin
        imagePlaneZ: Z position of image plane
        rmsSpread: RMS radius of the point cloud (mm)
        numValid: number of valid rays across all iterations
        error: optional error message if something failed
    """
    surfaces = optical_stack.get("surfaces", [])
    if not surfaces:
        return {"error": "No surfaces", "spots": [], "focusZ": 0, "imagePlaneZ": 0, "rmsSpread": 0, "numValid": 0}

    num_rays = int(optical_stack.get("numRays", 9) or 9)
    epd = float(optical_stack.get("entrancePupilDiameter", 10) or 10)
    wvl_nm = float(optical_stack.get("wavelengths", [587.6])[0] or 587.6)
    rng = random.Random(42)

    all_spots = []
    focus_z = 0.0
    z_origin = 0.0
    last_error = None

    for i in range(iterations):
        jittered_surfaces = _jitter_surfaces(surfaces, rng)
        surf_data_list = optical_stack_to_surf_data(jittered_surfaces)
        surface_diameters = [float(s.get("diameter", 25) or 25) for s in jittered_surfaces]

        try:
            opt_model = build_singlet_from_surface_data(
                surf_data_list,
                wvl_nm=wvl_nm,
                radius_mode=False,
                object_distance=1e10,
                epd=epd,
                surface_diameters=surface_diameters,
            )
        except Exception as e:
            last_error = str(e)
            continue

        # Configure field of view
        field_angles = optical_stack.get("fieldAngles", [0])
        if field_angles:
            osp = opt_model.optical_spec
            fov = osp.field_of_view
            fov.set_from_list([float(a) for a in field_angles])
            if fov.value == 0:
                fov.value = 1.0
            opt_model.update_model()
            opt_model.optical_spec.update_optical_properties()

        try:
            spot_xy, dxdy = run_spot_diagram(
                opt_model, num_rays=num_rays, fld=0, wvl=wvl_nm, foc=0.0
            )
        except Exception as e:
            last_error = str(e)
            continue

        valid = ~np.isnan(dxdy[:, 0])
        for idx in range(len(spot_xy)):
            if valid[idx]:
                all_spots.append([float(spot_xy[idx, 0]), float(spot_xy[idx, 1])])

        if i == 0:
            sm = opt_model.seq_model
            tfrms = sm.gbl_tfrms
            z_origin = tfrms[1][1][2] if len(tfrms) > 1 else 0
            efl, fod = get_focal_length(opt_model)
            bfl = fod.bfl if (fod and fod.efl != 0) else 50.0
            if not np.isfinite(bfl):
                bfl = 50.0
            last_surf_z = tfrms[-2][1][2] if len(tfrms) >= 2 else tfrms[-1][1][2]
            focus_z = last_surf_z + bfl - z_origin

    if not all_spots:
        return {
            "error": last_error or "No valid traces",
            "spots": [],
            "focusZ": focus_z,
            "imagePlaneZ": focus_z,
            "rmsSpread": 0.0,
            "numValid": 0,
        }

    spots_arr = np.array(all_spots)
    cx = float(np.mean(spots_arr[:, 0]))
    cy = float(np.mean(spots_arr[:, 1]))
    rms_spread = float(np.sqrt(np.mean((spots_arr[:, 0] - cx) ** 2 + (spots_arr[:, 1] - cy) ** 2)))

    return {
        "spots": [[float(p[0]), float(p[1])] for p in all_spots],
        "focusZ": focus_z,
        "imagePlaneZ": focus_z,
        "rmsSpread": rms_spread,
        "numValid": len(all_spots),
    }
