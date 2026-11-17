"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "DigiPay-DFA"
    app_version: str = "1.0.0"
    debug: bool = False

    database_url: str = "sqlite+aiosqlite:///./digipay.db"

    # CORS — frontend dev server
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Demo sender account
    demo_sender_upi_id: str = "demo.user@digipay"
    demo_sender_name: str = "Demo User"
    demo_sender_balance_paise: int = 1_000_000  # ₹10,000

    # Maximum simulated transaction amount in paise (₹1,00,000)
    max_amount_paise: int = 10_000_000

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


settings = Settings()
