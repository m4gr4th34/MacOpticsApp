"""
FastAPI backend for optical ray-tracing.
Accepts optical_stack JSON, runs rayoptics trace, returns (z,y) coords for rays and surfaces.
"""

import sys
import os

# NumPy 2.0 fix for rayoptics
import numpy as np
if not hasattr(np, "NaN"):
    np.NaN = np.nan

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

# Import after path/numpy setup
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)
from api.trace_service import run_trace

app = FastAPI(title="Optics Trace API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OpticalStackRequest(BaseModel):
    """Optical stack from React frontend."""
    surfaces: list[dict[str, Any]]
    entrancePupilDiameter: float = 10
    wavelengths: list[float] = [587.6]
    fieldAngles: list[float] = [0]
    numRays: int = 9


@app.post("/api/trace")
def trace_rays(req: OpticalStackRequest):
    """
    Run ray trace on optical_stack.
    Returns rays as list of [[z,y], ...] polylines, surface curves, focusZ, performance.
    """
    optical_stack = req.model_dump()
    return run_trace(optical_stack)


@app.get("/api/health")
def health():
    return {"status": "ok"}
