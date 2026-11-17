"""
Transaction API endpoints.

POST /api/transactions                    — Initiate a simulated payment.
GET  /api/transactions                    — Paginated transaction history.
GET  /api/transactions/{transaction_id}   — Single transaction detail with trace.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.core.database import get_db
from app.models.models import Transaction, DemoAccount
from app.schemas.schemas import (
    TransactionCreate,
    TransactionOut,
    TransactionListItem,
    TransactionListResponse,
    TraceStepOut,
)
from app.services.transaction_service import create_transaction, _build_out

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionOut, status_code=201)
async def initiate_transaction(
    payload: TransactionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate a simulated payment.
    The backend constructs the DFA event sequence, runs the engine,
    persists the transaction and trace, and returns the result.
    """
    try:
        return await create_transaction(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Internal server error during simulation.")


@router.get("", response_model=TransactionListResponse)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by reference or recipient UPI ID"),
    db: AsyncSession = Depends(get_db),
):
    """Return a paginated, filterable list of simulated transactions."""
    query = select(Transaction).order_by(Transaction.created_at.desc())

    if status:
        query = query.where(Transaction.status == status.upper())

    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                Transaction.reference.ilike(term),
                Transaction.recipient_upi_id.ilike(term),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    transactions = result.scalars().all()

    items = []
    for txn in transactions:
        await db.refresh(txn, ["recipient_account"])
        recipient_name = (
            txn.recipient_account.display_name if txn.recipient_account else txn.recipient_upi_id
        )
        items.append(
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

    return TransactionListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Return a single transaction with its full DFA trace."""
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=404, detail=f"Transaction {transaction_id} not found.")

    return await _build_out(txn, db)
