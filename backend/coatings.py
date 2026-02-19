"""
Coatings service: Backward-compatible wrapper around CoatingService.
Import from coating_service for new code. Uses comprehensive 50+ coating library
and user-defined coatings from database.
"""

from typing import Any, Dict, List, Optional

from coating_service import CoatingService, get_coating_service
from coating_db import get_all_user_coatings

# Re-export for compatibility
COATING_TYPE_AR = "AR"
COATING_TYPE_HR = "HR"


def get_reflectivity(coating_name: Optional[str], lambda_nm: float) -> float:
    """Return R(λ) for coating. Uses uncoated ~4% if unknown."""
    user = get_all_user_coatings()
    svc = get_coating_service(user)
    return svc.get_reflectivity(coating_name, lambda_nm)


def is_hr_coating(coating_name: Optional[str]) -> bool:
    """True if coating is HR (reflects instead of refracts)."""
    user = get_all_user_coatings()
    svc = get_coating_service(user)
    return svc.is_hr_coating(coating_name)


def get_all_coatings() -> List[Dict[str, Any]]:
    """Return coating library for dropdown (built-in + user)."""
    user = get_all_user_coatings()
    svc = get_coating_service(user)
    lib = svc.get_library()
    return [
        {"name": c["name"], "description": c.get("description", ""), "is_hr": c.get("is_hr", False)}
        for c in lib
    ]
