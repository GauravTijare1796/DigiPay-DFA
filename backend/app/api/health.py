from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
    }
