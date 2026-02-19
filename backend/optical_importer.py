"""
OpticalImporter: Import lens systems from JSON (Zemax-style) and SVG files.
Maps imported data to the Surface model (Radius, Thickness, Material, Aperture).
"""

import json
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from glass_materials import get_material_by_name, refractive_index_at_wavelength

# Default wavelength for refractive index lookup
_DEFAULT_WVL_NM = 587.6
_DEFAULT_APERTURE_RADIUS = 12.5  # mm; diameter = 2 * aperture_radius

logger = logging.getLogger(__name__)


def _parse_radius(v: Any) -> float:
    """
    Parse radius from JSON. Accepts numbers and string 'infinity'/'inf'/'flat'.
    Maps infinity to 0 (flat surface; curvature = 0 in ray-tracing).
    """
    if v is None or v == "":
        return 0.0
    if isinstance(v, str):
        s = str(v).strip().lower()
        if s in ("infinity", "inf", "flat"):
            return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _surface_from_dict(
    raw: Dict[str, Any],
    idx: int,
) -> Dict[str, Any]:
    """
    Map a raw surface dict to our Surface model.
    Supports flexible keys: Radius/radius, Thickness/thickness, Material/material,
    Diameter/diameter, Type/type, etc.
    """
    def get_float(d: Dict, *keys: str, default: float = 0.0) -> float:
        for k in keys:
            v = d.get(k)
            if v is not None and v != "":
                try:
                    return float(v)
                except (TypeError, ValueError):
                    pass
        return default

    def get_str(d: Dict, *keys: str, default: str = "") -> str:
        for k in keys:
            v = d.get(k)
            if v is not None and v != "":
                return str(v).strip()
        return default

    # Radius: accept number or string 'infinity'/'inf'/'flat' -> 0 (flat)
    radius_raw = raw.get("Radius") or raw.get("radius") or raw.get("R")
    if radius_raw is None:
        curv = get_float(raw, "Curvature", "curvature", "CURV", default=0.0)
        radius = 1.0 / curv if curv != 0 else 0.0
    else:
        radius = _parse_radius(radius_raw)
    if radius == 0:
        curv = get_float(raw, "Curvature", "curvature", "CURV", default=0.0)
        if curv != 0:
            radius = 1.0 / curv

    thickness = get_float(raw, "Thickness", "thickness", "T", "spacing", default=0.0)
    # Diameter: prefer explicit diameter/aperture; else 2 * aperture_radius (default 12.5)
    diameter = get_float(raw, "Diameter", "diameter", "DIAM", "aperture", default=0.0)
    if diameter <= 0:
        ar = get_float(raw, "aperture_radius", "ApertureRadius", "APERTURE_RADIUS", default=_DEFAULT_APERTURE_RADIUS)
        diameter = 2 * ar
    diameter = max(0.1, diameter)
    material_raw = get_str(raw, "Material", "material", "Glass", "GLASS")
    surf_type = get_str(raw, "Type", "type", default="Glass").lower()
    if surf_type in ("air", "object", "image", "stop"):
        surf_type = "Air"
        material = "Air"
        n = 1.0
    else:
        surf_type = "Glass"
        material = material_raw or "N-BK7"
        mat = get_material_by_name(material)
        n = (
            refractive_index_at_wavelength(_DEFAULT_WVL_NM, material, 1.52)
            if mat
            else 1.52
        )

    return {
        "id": str(uuid.uuid4()),
        "type": surf_type,
        "radius": radius,
        "thickness": thickness,
        "refractiveIndex": n,
        "diameter": max(0.1, diameter),
        "material": material,
        "description": get_str(raw, "Comment", "comment", "description") or f"Surface {idx + 1}",
    }


def _parse_json_surfaces(data: Any) -> List[Dict[str, Any]]:
    """Extract surfaces array from JSON. Supports various structures."""
    surfaces_raw: List[Dict[str, Any]] = []

    if isinstance(data, list):
        surfaces_raw = data
    elif isinstance(data, dict):
        for key in ("surfaces", "Surfaces", "sequence", "Surf", "elements"):
            arr = data.get(key)
            if isinstance(arr, list):
                surfaces_raw = arr
                break
        if not surfaces_raw and "surface" in data:
            s = data["surface"]
            if isinstance(s, dict):
                surfaces_raw = [s]
            elif isinstance(s, list):
                surfaces_raw = s

    if not surfaces_raw:
        return []

    result: List[Dict[str, Any]] = []
    for i, raw in enumerate(surfaces_raw):
        if not isinstance(raw, dict):
            logger.warning("Surface %d: expected dict, got %s", i + 1, type(raw).__name__)
            continue
        try:
            surf = _surface_from_dict(raw, i)
            result.append(surf)
        except (KeyError, TypeError, ValueError) as e:
            logger.exception("Surface %d parse error: %s (raw keys: %s)", i + 1, e, list(raw.keys()) if raw else [])
            raise
    return result


def import_from_json(content: bytes) -> List[Dict[str, Any]]:
    """
    Parse JSON lens system (Zemax-style or generic).
    Returns list of Surface objects compatible with frontend.
    """
    try:
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError as e:
        logger.exception("JSON parse error: %s", e)
        raise ValueError(f"Invalid JSON: {e}") from e
    except Exception as e:
        logger.exception("Unexpected error parsing JSON: %s", e)
        raise ValueError(f"Invalid JSON: {e}") from e

    try:
        surfaces = _parse_json_surfaces(data)
    except (KeyError, TypeError, ValueError) as e:
        logger.exception("Surface parsing error (KeyError/TypeError/ValueError): %s", e)
        raise ValueError(f"Failed to parse surfaces: {e}") from e
    except Exception as e:
        logger.exception("Unexpected error parsing surfaces: %s", e)
        raise ValueError(f"Failed to parse surfaces: {e}") from e

    if not surfaces:
        raise ValueError("No surfaces found in JSON. Expected 'surfaces' array or similar.")
    return surfaces


def _extract_surface_info_from_path(path) -> Tuple[Optional[float], float, float]:
    """
    Extract (radius, center_x, diameter) from an svgpathtools Path.
    - radius: from Arc segments (geometric mean of rx, ry for ellipse; inf for flat)
    - center_x: centroid x (optical axis position)
    - diameter: extent in y direction
    """
    from svgpathtools import Path

    radii: List[float] = []
    pts: List[complex] = []
    for seg in path:
        if hasattr(seg, "radius"):
            rx = abs(seg.radius.real)
            ry = abs(seg.radius.imag)
            r = (rx * ry) ** 0.5 if (rx > 0 and ry > 0) else max(rx, ry)
            if r > 1e-6:
                radii.append(r)
        # Collect points for centroid and extent
        if hasattr(seg, "start"):
            pts.append(seg.start)
        if hasattr(seg, "end"):
            pts.append(seg.end)
        # Sample a few points for curves
        if hasattr(seg, "point"):
            for t in (0, 0.5, 1):
                try:
                    pts.append(seg.point(t))
                except Exception:
                    pass

    if not pts:
        return None, 0.0, 25.0

    xs = [p.real for p in pts]
    ys = [p.imag for p in pts]
    center_x = (min(xs) + max(xs)) / 2
    diameter = max(ys) - min(ys) if ys else 25.0
    diameter = max(0.1, diameter)

    radius = (sum(radii) / len(radii)) if radii else None  # None = flat
    return radius, center_x, diameter


def import_from_svg(content: bytes) -> List[Dict[str, Any]]:
    """
    Parse SVG lens cross-section using svgpathtools.
    Extracts curvatures from arcs and thicknesses from distances between paths.
    Assumes: x = optical axis, y = aperture; paths ordered left-to-right.
    """
    try:
        from svgpathtools import svgstr2paths
    except ImportError as e:
        raise ImportError(
            "svgpathtools is required for SVG import. Install with: pip install svgpathtools"
        ) from e

    svg_str = content.decode("utf-8", errors="replace")
    try:
        paths, _ = svgstr2paths(svg_str)
    except Exception as e:
        raise ValueError(f"Failed to parse SVG paths: {e}") from e

    if not paths:
        raise ValueError("No paths found in SVG.")

    # Extract (radius, center_x, diameter) for each path
    infos: List[Tuple[Optional[float], float, float]] = []
    for path in paths:
        r, cx, d = _extract_surface_info_from_path(path)
        infos.append((r, cx, d))

    # Sort by center_x (optical axis position, left to right)
    indexed = list(enumerate(infos))
    indexed.sort(key=lambda x: x[1][1])

    surfaces: List[Dict[str, Any]] = []
    for i, (_, (radius, center_x, diameter)) in enumerate(indexed):
        # Radius: positive = convex toward object (left), negative = concave
        # SVG y increases downward; arc orientation may need sign. Use positive by default.
        r_mm = radius if radius is not None else 0.0  # 0 = flat (infinite radius)
        # Thickness: distance to next surface
        thickness = 0.0
        if i + 1 < len(indexed):
            next_cx = indexed[i + 1][1][1]
            thickness = abs(next_cx - center_x)

        # Alternate Glass / Air for typical lens layout
        surf_type = "Glass" if (i % 2 == 0 and i < len(indexed) - 1) else "Air"
        material = "N-BK7" if surf_type == "Glass" else "Air"
        n = (
            refractive_index_at_wavelength(_DEFAULT_WVL_NM, material, 1.52)
            if surf_type == "Glass"
            else 1.0
        )

        surfaces.append({
            "id": str(uuid.uuid4()),
            "type": surf_type,
            "radius": r_mm,
            "thickness": thickness,
            "refractiveIndex": n,
            "diameter": diameter,
            "material": material,
            "description": f"Surface {i + 1} (from SVG)",
        })

    # Last surface typically has 0 thickness (image plane)
    if surfaces:
        surfaces[-1]["thickness"] = 0.0

    return surfaces


def import_lens_system(content: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Import lens system from file content. Infers format from filename extension.
    Returns array of Surface objects for the frontend.
    """
    ext = (filename or "").lower().split(".")[-1]
    if ext == "json":
        return import_from_json(content)
    if ext == "svg":
        return import_from_svg(content)
    raise ValueError(
        f"Unsupported file type '.{ext}'. Use .json (Zemax-style) or .svg."
    )
