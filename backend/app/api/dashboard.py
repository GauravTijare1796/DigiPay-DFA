"""
Dashboard and demo account endpoints.

GET /api/dashboard/summary  — Aggregated statistics from the database.
GET /api/demo/accounts      — List of demo profiles.
POST /api/demo/reset        — Reset demo account balances to defaults.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.config import settings
from app.models.models import DemoAccount, Transaction
from app.schemas.schemas import DashboardSummary, TransactionListItem, DemoAccountOut

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    """Return aggregated statistics calculated from the actual database records."""

    # Status counts
    status_result = await db.execute(
        select(Transaction.status, func.count(Transaction.id))
        .group_by(Transaction.status)
    )
    status_counts: dict[str, int] = {row[0]: row[1] for row in status_result}

    # Total simulated amount (successful transactions only)
    amount_result = await db.execute(
        select(func.sum(Transaction.amount_paise)).where(Transaction.status == "SUCCESS")
    )
    total_amount = amount_result.scalar() or 0

    # Recent transactions (last 5)
    recent_result = await db.execute(
        select(Transaction).order_by(Transaction.created_at.desc()).limit(5)
    )
    recent_txns = recent_result.scalars().all()

    recent_items = []
    for txn in recent_txns:
        await db.refresh(txn, ["recipient_account"])
        recipient_name = (
            txn.recipient_account.display_name if txn.recipient_account else txn.recipient_upi_id
        )
        recent_items.append(
            TransactionListItem(
                id=txn.id,
                reference=txn.reference,
                sender_upi_id=txn.sender_upi_id,
                recipient_upi_id=txn.recipient_upi_id,
                recipient_display_name=recipient_name,
                amount_paise=txn.amount_paise,
                amount_inr=txn.amount_paise / 100,
                status=txn.status,
                terminal_state=txn.terminal_state,
                scenario=txn.scenario,
                created_at=txn.created_at,
            )
        )

    # Sender balance
    sender_result = await db.execute(
        select(DemoAccount).where(DemoAccount.upi_id == settings.demo_sender_upi_id)
    )
    sender = sender_result.scalar_one_or_none()
    sender_balance = sender.balance_paise if sender else 0

    total_txns = sum(status_counts.values())

    return DashboardSummary(
        total_transactions=total_txns,
        successful=status_counts.get("SUCCESS", 0),
        failed=status_counts.get("FAILED", 0),
        rejected=status_counts.get("REJECTED", 0),
        timed_out=status_counts.get("TIMED_OUT", 0),
        total_amount_paise=total_amount,
        total_amount_inr=total_amount / 100,
        recent_transactions=recent_items,
        sender_balance_paise=sender_balance,
        sender_balance_inr=sender_balance / 100,
    )


@router.get("/demo/accounts", response_model=list[DemoAccountOut])
async def list_demo_accounts(db: AsyncSession = Depends(get_db)):
    """Return all active demo accounts."""
    result = await db.execute(
        select(DemoAccount).where(DemoAccount.is_active.is_(True)).order_by(DemoAccount.id)
    )
    accounts = result.scalars().all()
    return [DemoAccountOut.from_orm_model(a) for a in accounts]


@router.post("/demo/reset", status_code=200)
async def reset_demo_balances(db: AsyncSession = Depends(get_db)):
    """
    Reset all demo account balances to their original values.
    Useful for demonstration purposes.  Does NOT delete transaction history.
    """
    defaults = {
        settings.demo_sender_upi_id: settings.demo_sender_balance_paise,
        "alex@demo": 500_000,
        "priya@demo": 750_000,
        "merchant@demo": 2_000_000,
    }
    result = await db.execute(select(DemoAccount))
    accounts = result.scalars().all()
    for acct in accounts:
        if acct.upi_id in defaults:
            acct.balance_paise = defaults[acct.upi_id]
    await db.commit()
    return {"message": "Demo balances reset to defaults."}
