"""
Backend integration tests.

Uses an isolated in-memory SQLite database — never touches the dev database.
"""

import asyncio

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.core.database import get_db
from app.models.models import Base, DemoAccount
from app.core.config import settings

# ── Test database setup ────────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(
    bind=test_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Create tables and seed accounts before each test; drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed demo accounts
    async with TestSessionLocal() as session:
        accounts = [
            DemoAccount(
                upi_id=settings.demo_sender_upi_id,
                display_name="Demo User",
                balance_paise=1_000_000,
                is_active=True,
                is_sender=True,
            ),
            DemoAccount(
                upi_id="alex@demo",
                display_name="Alex Sharma",
                balance_paise=500_000,
                is_active=True,
                is_sender=False,
            ),
            DemoAccount(
                upi_id="priya@demo",
                display_name="Priya Patil",
                balance_paise=750_000,
                is_active=True,
                is_sender=False,
            ),
            DemoAccount(
                upi_id="merchant@demo",
                display_name="Demo Merchant",
                balance_paise=2_000_000,
                is_active=True,
                is_sender=False,
            ),
        ]
        session.add_all(accounts)
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ── Health ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ── DFA definition ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dfa_definition_returns_all_states(client):
    resp = await client.get("/api/dfa/definition")
    assert resp.status_code == 200
    data = resp.json()
    assert "states" in data
    assert "alphabet" in data
    assert "transitions" in data
    assert len(data["states"]) == 14  # q0–q13


@pytest.mark.asyncio
async def test_dfa_simulate_successful_sequence(client):
    resp = await client.post("/api/dfa/simulate", json={
        "input_sequence": [
            "START", "RECIPIENT_VALID", "AMOUNT_VALID",
            "AUTH_SUCCESS", "BALANCE_SUFFICIENT", "PROCESS", "PROCESS_SUCCESS"
        ]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted"] is True
    assert data["terminal_state"] == "q9"


@pytest.mark.asyncio
async def test_dfa_simulate_invalid_symbol(client):
    resp = await client.post("/api/dfa/simulate", json={"input_sequence": ["INVALID_SYMBOL"]})
    assert resp.status_code == 422


# ── Transactions ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_successful_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 10000,
        "scenario": "success",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "SUCCESS"
    assert data["terminal_state"] == "q9"
    assert len(data["trace"]) > 0


@pytest.mark.asyncio
async def test_invalid_recipient_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "nobody@demo",
        "amount_paise": 10000,
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert data["terminal_state"] == "q10"


@pytest.mark.asyncio
async def test_invalid_amount_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 10000,
        "scenario": "invalid_amount",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "REJECTED"


@pytest.mark.asyncio
async def test_auth_failure_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 10000,
        "scenario": "auth_failure",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "FAILED"
    assert data["terminal_state"] == "q11"


@pytest.mark.asyncio
async def test_insufficient_balance_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 10000,
        "scenario": "insufficient_balance",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "REJECTED"


@pytest.mark.asyncio
async def test_actual_insufficient_balance_is_rejected_without_debit(client):
    amount_paise = 1_000_001
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": amount_paise,
    })

    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "REJECTED"
    assert data["terminal_state"] == "q10"
    assert [step["destination_state"] for step in data["trace"]][-1] == "q10"
    assert "Insufficient demo balance" in data["outcome_reason"]

    accounts_resp = await client.get("/api/demo/accounts")
    accounts = {account["upi_id"]: account for account in accounts_resp.json()}
    assert accounts[settings.demo_sender_upi_id]["balance_paise"] == 1_000_000


@pytest.mark.asyncio
async def test_process_failure_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 10000,
        "scenario": "process_failure",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "FAILED"


@pytest.mark.asyncio
async def test_timeout_transaction(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 10000,
        "scenario": "process_timeout",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "TIMED_OUT"
    assert data["terminal_state"] == "q12"


@pytest.mark.asyncio
async def test_zero_amount_rejected_by_pydantic(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 0,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_negative_amount_rejected(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": -100,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_excessive_amount_rejected(client):
    resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 999_999_999,
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_successful_transaction_debits_balance(client):
    # Get initial balance
    accounts_resp = await client.get("/api/demo/accounts")
    accounts = {a["upi_id"]: a for a in accounts_resp.json()}
    initial_balance = accounts[settings.demo_sender_upi_id]["balance_paise"]

    await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 5000,
        "scenario": "success",
    })

    accounts_resp2 = await client.get("/api/demo/accounts")
    accounts2 = {a["upi_id"]: a for a in accounts_resp2.json()}
    new_balance = accounts2[settings.demo_sender_upi_id]["balance_paise"]

    assert new_balance == initial_balance - 5000


@pytest.mark.asyncio
async def test_failed_transaction_does_not_debit_balance(client):
    accounts_resp = await client.get("/api/demo/accounts")
    accounts = {a["upi_id"]: a for a in accounts_resp.json()}
    initial_balance = accounts[settings.demo_sender_upi_id]["balance_paise"]

    await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 5000,
        "scenario": "auth_failure",
    })

    accounts_resp2 = await client.get("/api/demo/accounts")
    accounts2 = {a["upi_id"]: a for a in accounts_resp2.json()}
    assert accounts2[settings.demo_sender_upi_id]["balance_paise"] == initial_balance


@pytest.mark.asyncio
async def test_idempotency_prevents_duplicate(client):
    payload = {
        "recipient_upi_id": "alex@demo",
        "amount_paise": 1000,
        "scenario": "success",
        "idempotency_key": "test-idem-key-001",
    }
    resp1 = await client.post("/api/transactions", json=payload)
    resp2 = await client.post("/api/transactions", json=payload)

    assert resp1.status_code == 201
    assert resp2.status_code == 201
    # Same transaction returned
    assert resp1.json()["reference"] == resp2.json()["reference"]

    # Balance should only be debited once
    accounts_resp = await client.get("/api/demo/accounts")
    accounts = {a["upi_id"]: a for a in accounts_resp.json()}
    # Started at 1,000,000; two calls with same key → only 1000 deducted
    assert accounts[settings.demo_sender_upi_id]["balance_paise"] == 999_000


@pytest.mark.asyncio
async def test_concurrent_idempotent_requests_create_one_debit(client):
    payload = {
        "recipient_upi_id": "alex@demo",
        "amount_paise": 1000,
        "scenario": "success",
        "idempotency_key": "concurrent-idem-key-001",
    }
    first, second = await asyncio.gather(
        client.post("/api/transactions", json=payload),
        client.post("/api/transactions", json=payload),
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["reference"] == second.json()["reference"]

    accounts_resp = await client.get("/api/demo/accounts")
    accounts = {account["upi_id"]: account for account in accounts_resp.json()}
    assert accounts[settings.demo_sender_upi_id]["balance_paise"] == 999_000


@pytest.mark.asyncio
async def test_concurrent_payments_cannot_overspend_sender_balance(client):
    payload = {"recipient_upi_id": "alex@demo", "amount_paise": 600_000}
    first, second = await asyncio.gather(
        client.post("/api/transactions", json=payload),
        client.post("/api/transactions", json=payload),
    )

    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    results = [first.json(), second.json()]
    assert sorted(result["status"] for result in results) == ["REJECTED", "SUCCESS"]
    assert {result["terminal_state"] for result in results} == {"q9", "q10"}

    accounts_resp = await client.get("/api/demo/accounts")
    accounts = {account["upi_id"]: account for account in accounts_resp.json()}
    assert accounts[settings.demo_sender_upi_id]["balance_paise"] == 400_000


# ── History / List ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_transaction_list_empty(client):
    resp = await client.get("/api/transactions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_transaction_list_after_creation(client):
    await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo",
        "amount_paise": 1000,
        "scenario": "success",
    })
    resp = await client.get("/api/transactions")
    data = resp.json()
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_transaction_detail(client):
    create_resp = await client.post("/api/transactions", json={
        "recipient_upi_id": "priya@demo",
        "amount_paise": 2500,
        "scenario": "success",
    })
    txn_id = create_resp.json()["id"]

    resp = await client.get(f"/api/transactions/{txn_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == txn_id
    assert len(data["trace"]) > 0


@pytest.mark.asyncio
async def test_transaction_not_found(client):
    resp = await client.get("/api/transactions/99999")
    assert resp.status_code == 404


# ── Dashboard ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_summary_empty(client):
    resp = await client.get("/api/dashboard/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_transactions"] == 0
    assert data["successful"] == 0


@pytest.mark.asyncio
async def test_dashboard_summary_counts(client):
    await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo", "amount_paise": 1000, "scenario": "success",
    })
    await client.post("/api/transactions", json={
        "recipient_upi_id": "alex@demo", "amount_paise": 1000, "scenario": "auth_failure",
    })

    resp = await client.get("/api/dashboard/summary")
    data = resp.json()
    assert data["total_transactions"] == 2
    assert data["successful"] == 1
    assert data["failed"] == 1
