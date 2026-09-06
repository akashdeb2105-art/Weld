from fastapi import APIRouter

from ..config import settings
from ..schemas import HealthResponse

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok", service="weld-api", version="0.1.0", environment=settings.environment
    )
