"""Create the local database schema and seed any missing demo accounts."""

import asyncio

from app.core.database import engine, init_db


async def main() -> None:
    try:
        await init_db()
    finally:
        await engine.dispose()

    print("Database initialized and demo accounts seeded.")


if __name__ == "__main__":
    asyncio.run(main())