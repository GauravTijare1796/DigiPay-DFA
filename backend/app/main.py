"""
DigiPay-DFA — FastAPI application entry point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api import health, dfa, transactions, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "DigiPay-DFA: A Deterministic Finite Automata-Based Digital Payment "
        "Transaction Validator. Academic simulation — no real money involved."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routers
app.include_router(health.router, prefix="/api")
app.include_router(dfa.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/", include_in_schema=False)
async def root():
    return {
        "message": "DigiPay-DFA API is running.",
        "docs": "/api/docs",
        "health": "/api/health",
    }
