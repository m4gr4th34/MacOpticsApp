#!/usr/bin/env python3
"""
Streamlit web app for lens ray-optics analysis.
Dynamic multi-surface editor; main area dedicated to optical layout visualization.
"""

import sys
import os
import types

# Ensure script directory is on path
_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)

# Stub rayoptics.gui.appcmds before any opticalmodel import (breaks circular import)
if "rayoptics.gui.appcmds" not in sys.modules:
    _ro = __import__("rayoptics", fromlist=[])
    _gui_dir = os.path.join(os.path.dirname(_ro.__file__), "gui")
    if sys.modules.get("rayoptics.gui") is None:
        _gui_mod = types.ModuleType("rayoptics.gui")
        _gui_mod.__path__ = [_gui_dir]
        sys.modules["rayoptics.gui"] = _gui_mod
    _stub = types.ModuleType("rayoptics.gui.appcmds")
    _stub.open_model = lambda *a, **k: (_ for _ in ()).throw(NotImplementedError("headless"))
    sys.modules["rayoptics.gui.appcmds"] = _stub

# NumPy 2.0 fix for rayoptics
import numpy as np
if not hasattr(np, "NaN"):
    np.NaN = np.nan

import streamlit as st
import pandas as pd

# Default surface schema (Z-Position computed by recalc_z_positions)
DEFAULT_SURFACES = [
    {"Type": "Glass", "Radius": 100.0, "Thickness": 5.0, "Refractive Index": 1.5168, "Z-Position": 0.0},
    {"Type": "Air", "Radius": -100.0, "Thickness": 95.0, "Refractive Index": 1.0, "Z-Position": 5.0},
]

NEW_SURFACE_ROW = {"Type": "Air", "Radius": 0.0, "Thickness": 10.0, "Refractive Index": 1.0, "Z-Position": 0.0}


def recalc_z_positions(optical_stack):
    """
    Recalculate Z-Position for every surface as sum of preceding thicknesses.
    Updates surfaces in place. Surface 0: Z=0, Surface 1: Z=t0, Surface 2: Z=t0+t1, ...
    """
    z = 0.0
    for s in optical_stack:
        s["Z-Position"] = round(z, 4)
        z += float(s.get("Thickness", 0) or 0)


def add_surface(index, radius, thickness, material):
    """
    Insert a surface at the given index in optical_stack using list.insert().
    material: "Glass" (n=1.5168), "Air" (n=1.0), or numeric refractive index.
    """
    n_map = {"Glass": 1.5168, "Air": 1.0}
    try:
        n = n_map.get(material, float(material)) if isinstance(material, str) else float(material)
    except (TypeError, ValueError):
        n = 1.0
    surf_type = "Glass" if n > 1.01 else "Air"
    new_element = {"Type": surf_type, "Radius": float(radius), "Thickness": float(thickness), "Refractive Index": n}
    st.session_state.optical_stack.insert(index, new_element)


def sort_by_z_position(optical_stack):
    """
    Reorder surfaces by cumulative Z (distance from source).
    Z = sum of thicknesses of all preceding surfaces.
    """
    if len(optical_stack) <= 1:
        return optical_stack
    z_and_surf = []
    z = 0.0
    for s in optical_stack:
        z_and_surf.append((z, dict(s)))
        z += float(s.get("Thickness", 0) or 0)
    return [s for _, s in sorted(z_and_surf, key=lambda x: x[0])]


def _normalize_record(r):
    """Ensure a record has valid defaults for all fields (handles new rows from + button)."""
    return {
        "Type": r.get("Type") if r.get("Type") in ("Glass", "Air") else "Air",
        "Radius": float(r.get("Radius") or 0) if pd.notna(r.get("Radius")) else 0.0,
        "Thickness": float(r.get("Thickness") or 10) if pd.notna(r.get("Thickness")) else 10.0,
        "Refractive Index": float(r.get("Refractive Index") or 1) if pd.notna(r.get("Refractive Index")) else 1.0,
    }


def surfaces_to_surf_data(surfaces):
    surf_data_list = []
    for row in surfaces:
        r = float(row.get("Radius", 0) or 0)
        t = float(row.get("Thickness", 0) or 0)
        n = float(row.get("Refractive Index", 1) or 1)
        curvature = 1.0 / r if r != 0 else 0.0
        v = 64.2 if (row.get("Type") == "Glass") else 0.0
        surf_data_list.append([curvature, t, n, v])
    return surf_data_list


st.set_page_config(page_title="Lens Ray-Optics Calculator", layout="wide")

# --- Session state: optical_stack (list of surfaces) ---
if "optical_stack" not in st.session_state:
    st.session_state.optical_stack = [dict(s) for s in DEFAULT_SURFACES]
    recalc_z_positions(st.session_state.optical_stack)

# --- Sidebar: global params + surface table ---
with st.sidebar:
    st.header("Lens Parameters")
    st.markdown("Configure the optical system. Radius in mm (0 = flat).")

    wvl_nm = st.number_input(
        "Wavelength (nm)",
        min_value=300.0,
        max_value=2000.0,
        value=587.6,
        step=1.0,
        help="Design wavelength, e.g. 587.6 for d-line",
    )
    num_rays = st.slider("Number of rays", 3, 21, 11, 2)
    show_grid = st.toggle("Toggle Grid", value=True, help="Show technical grid / clean canvas")

    st.divider()
    st.subheader("Surfaces")

    stack = st.session_state.optical_stack
    recalc_z_positions(stack)

    # Insert Surface toolbar
    insert_options = [f"Insert after surface {i}" for i in range(len(stack))]
    if not insert_options:
        insert_options = ["Insert at position 0"]
    insert_col, plus_col, clear_col, sort_col = st.columns([2, 1, 1, 1])
    with insert_col:
        insert_after = st.selectbox(
            "Insert after surface…",
            options=insert_options,
            index=len(insert_options) - 1 if insert_options else 0,
            key="insert_surface_select",
        )
    with plus_col:
        insert_clicked = st.button("➕", help="Insert surface at selected position", key="insert_plus")
    with clear_col:
        clear_clicked = st.button("Clear All", use_container_width=True)
    with sort_col:
        sort_clicked = st.button("Sort by Z", use_container_width=True, help="Sort by distance from source")

    if insert_clicked:
        if len(stack) == 0:
            add_surface(0, 0.0, 10.0, "Air")
        else:
            idx = insert_options.index(insert_after)
            add_surface(idx + 1, 0.0, 10.0, "Air")
        recalc_z_positions(st.session_state.optical_stack)
        st.rerun()
    if clear_clicked:
        st.session_state.optical_stack = [dict(NEW_SURFACE_ROW)]
        recalc_z_positions(st.session_state.optical_stack)
        st.rerun()
    if sort_clicked:
        st.session_state.optical_stack = sort_by_z_position(st.session_state.optical_stack)
        recalc_z_positions(st.session_state.optical_stack)
        st.rerun()

    df = pd.DataFrame(st.session_state.optical_stack)
    edited_df = st.data_editor(
        df,
        column_config={
            "Z-Position": st.column_config.NumberColumn(
                "Z-Position (mm)",
                format="%.2f",
                help="Calculated from preceding thicknesses (read-only)",
            ),
            "Type": st.column_config.SelectboxColumn(
                "Type",
                options=["Glass", "Air"],
                required=True,
            ),
            "Radius": st.column_config.NumberColumn(
                "Radius (mm)",
                format="%.2f",
                default=0.0,
            ),
            "Thickness": st.column_config.NumberColumn(
                "Thickness (mm)",
                format="%.2f",
                default=10.0,
            ),
            "Refractive Index": st.column_config.NumberColumn(
                "Refractive Index",
                format="%.3f",
                default=1.0,
            ),
        },
        column_order=["Z-Position", "Type", "Radius", "Thickness", "Refractive Index"],
        disabled=["Z-Position"],
        use_container_width=True,
        hide_index=True,
        num_rows="dynamic",
    )

    # Sync data_editor → optical_stack (single source of truth). Handles add (+), delete (trash), edit.
    if edited_df is not None:
        if len(edited_df) == 0:
            st.session_state.optical_stack = []
        else:
            records = []
            for r in edited_df.to_dict("records"):
                nr = _normalize_record(r)
                records.append(nr)
            st.session_state.optical_stack = records
            recalc_z_positions(st.session_state.optical_stack)

# --- Main area: header + visualization ---
st.title("Lens Ray-Optics Calculator")
st.markdown(
    "Interactive optical layout and ray trace for multi-surface optical systems. "
    "Edit the surface table in the sidebar to add, remove, or modify surfaces. "
    "The visualization updates automatically when the table changes."
)
st.markdown("---")

# Build model and render
surfaces = st.session_state.optical_stack
if not surfaces:
    st.warning("Add at least one surface to run the analysis.")
else:
    try:
        surf_data_list = surfaces_to_surf_data(surfaces)
        surface_diameters = [10.0] * len(surfaces)  # default 10 mm diameter per surface

        from singlet_rayoptics import (
            build_singlet_from_surface_data,
            calculate_and_format_results,
            get_ray_trace_table,
        )
        from optics_visualization import render_optical_layout

        opt_model = build_singlet_from_surface_data(
            surf_data_list, wvl_nm=wvl_nm, surface_diameters=surface_diameters
        )
        results_text = calculate_and_format_results(
            surf_data_list, wvl_nm=wvl_nm, surface_diameters=surface_diameters
        )
        fig = render_optical_layout(
            opt_model, wvl_nm=wvl_nm, num_rays=num_rays,
            return_figure=True, figsize=(12, 6), show_grid=show_grid
        )

        st.plotly_chart(fig, use_container_width=True)

        with st.expander("Numerical results"):
            st.code(results_text, language=None)

        with st.expander("Technical Specifications", expanded=False):
            ray_table = get_ray_trace_table(opt_model, num_rays=num_rays, wvl=wvl_nm)
            if ray_table:
                df_rays = pd.DataFrame(ray_table)
                st.dataframe(df_rays, use_container_width=True, hide_index=True)
            else:
                st.info("No ray-trace data available.")

    except Exception as e:
        st.error(f"Error: {e}")
        st.info("Check that radius, thickness, and refractive index are valid. Use n=1 for air.")
