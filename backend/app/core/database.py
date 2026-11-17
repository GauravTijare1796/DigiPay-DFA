"""
Async SQLite database setup using SQLAlchemy + aiosqlite.
Provides:
  - engine
  - AsyncSessionLocal factory
  - get_db() FastAPI dependency
  - init_db() startup routine
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import event
from app.core.config import settings
from app.models.models import Base

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def init_db() -> None:
    """Create all tables and seed demo accounts on first run."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await _seed_demo_accounts()


async def _seed_demo_accounts() -> None:
    """Insert demo accounts if they don't already exist."""
    from app.models.models import DemoAccount
    from sqlalchemy import select

    demo_accounts = [
        {
            "upi_id": settings.demo_sender_upi_id,
            "display_name": settings.demo_sender_name,
            "balance_paise": settings.demo_sender_balance_paise,
            "is_active": True,
            "is_sender": True,
        },
        {
            "upi_id": "alex@demo",
            "display_name": "Alex Sharma",
            "balance_paise": 500_000,
            "is_active": True,
            "is_sender": False,
        },
        {
            "upi_id": "priya@demo",
            "display_name": "Priya Patil",
            "balance_paise": 750_000,
            "is_active": True,
            "is_sender": False,
        },
        {
            "upi_id": "merchant@demo",
            "display_name": "Demo Merchant",
            "balance_paise": 2_000_000,
            "is_active": True,
            "is_sender": False,
        },
    ]

    async with AsyncSessionLocal() as session:
        for acct_data in demo_accounts:
            result = await session.execute(
                select(DemoAccount).where(DemoAccount.upi_id == acct_data["upi_id"])
            )
            if result.scalar_one_or_none() is None:
                session.add(DemoAccount(**acct_data))
        await session.commit()


async def get_db():
    """FastAPI dependency — yields an AsyncSession per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
