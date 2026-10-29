from contextlib import asynccontextmanager
import logging
from os import getenv
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .persistence import SettingsStorageError
from .routes import (
    create_settings_router,
    create_system_controls_router,
    create_system_metrics_router,
    create_system_time_router,
    create_theme_assets_router,
    create_themes_router,
)
from .settings import SettingNotFoundError, SettingsService

logger = logging.getLogger(__name__)
settings_service = SettingsService()


def SystemMetricsService(*args: Any, **kwargs: Any) -> Any:
    """Load system metrics only when the application lifespan starts."""
    from .system_metrics import SystemMetricsService as _SystemMetricsService

    return _SystemMetricsService(*args, **kwargs)


def _hardware_monitor_enabled(service: SettingsService) -> bool:
    try:
        value = service.get("app", "hardware_monitor_enabled")
    except SettingNotFoundError:
        return True
    except SettingsStorageError:
        logger.warning("Could not read hardware monitor setting; keeping it enabled", exc_info=True)
        return True
    if isinstance(value, bool):
        return value
    logger.warning("Ignoring invalid app.hardware_monitor_enabled setting; keeping HardwareMonitor enabled")
    return True


@asynccontextmanager
async def lifespan(application: FastAPI):
    metrics_service = SystemMetricsService(
        hardware_monitor_enabled=_hardware_monitor_enabled(settings_service),
    )
    application.state.system_metrics = metrics_service
    try:
        yield
    finally:
        metrics_service.close()


app = FastAPI(title="WinDesktop Webskin API", version="0.1.0", lifespan=lifespan)

frontend_origins = [
    origin.strip()
    for origin in getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:4321,http://127.0.0.1:4321",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(create_settings_router(settings_service))
app.include_router(create_system_metrics_router(lambda requested_fields=None: app.state.system_metrics.collect(requested_fields)))
app.include_router(create_system_time_router())
app.include_router(create_system_controls_router())
app.include_router(create_themes_router())
app.include_router(create_theme_assets_router())


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}


@app.get("/api/status")
def status() -> dict[str, str]:
    return {"message": "Frontend and backend are connected."}

