"""
Transaction Service

Orchestrates a simulated payment by:
1. Validating business rules (recipient, amount, auth, balance).
2. Constructing the correct DFA input sequence.
3. Running the DFA engine to determine the outcome.
4. Persisting the transaction, trace, and balance changes atomically.

The DFA engine is the sole authority on the terminal outcome.
This service only constructs the event sequence; it never overrides the result.
"""

import asyncio
import weakref

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.models import DemoAccount, Transaction, TransactionTrace, BalanceLedger
from app.schemas.schemas import TransactionCreate, TransactionOut, TraceStepOut
from app.dfa.engine import generate_trace
from app.dfa.alphabet import Symbol
from app.dfa.states import State
from app.core.config import settings


# Maximum reasonable amount guard (also enforced by Pydantic schema)
MAX_AMOUNT_PAISE = settings.max_amount_paise

# ── Scenario identifiers ──────────────────────────────────────────────────────
SCENARIO_SUCCESS = "success"
SCENARIO_INVALID_RECIPIENT = "invalid_recipient"
SCENARIO_INVALID_AMOUNT = "invalid_amount"
SCENARIO_AUTH_FAIL = "auth_failure"
SCENARIO_INSUFFICIENT_BALANCE = "insufficient_balance"
SCENARIO_PROCESS_FAIL = "process_failure"
SCENARIO_TIMEOUT = "process_timeout"

_TRANSACTION_LOCKS: weakref.WeakKeyDictionary[
    asyncio.AbstractEventLoop, asyncio.Lock
] = weakref.WeakKeyDictionary()


def _transaction_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    lock = _TRANSACTION_LOCKS.get(loop)
    if lock is None:
        lock = asyncio.Lock()
        _TRANSACTION_LOCKS[loop] = lock
    return lock


async def _next_reference(session: AsyncSession) -> str:
    """Generate a sequential transaction reference like TXN-00000001."""
    result = await session.execute(select(func.count()).select_from(Transaction))
    count = (result.scalar() or 0) + 1
    return f"TXN-{count:08d}"


def _build_event_sequence(
    scenario: str | None,
    recipient_exists: bool,
    amount_ok: bool,
    balance_sufficient: bool,
) -> list[str]:
    """
    Construct the DFA input sequence for a given scenario.

    The sequence always begins with START.
    Subsequent symbols are determined by the test scenario and basic
    application-level validation results.  This keeps all transition
    logic in the DFA engine and all business validation in this service.
    """
    base = [Symbol.START]

    # Scenario overrides take precedence — they let us test every DFA path
    if scenario == SCENARIO_INVALID_RECIPIENT:
        return base + [Symbol.RECIPIENT_INVALID]

    if scenario == SCENARIO_INVALID_AMOUNT:
        return base + [Symbol.RECIPIENT_VALID, Symbol.AMOUNT_INVALID]

    if scenario == SCENARIO_AUTH_FAIL:
        return base + [Symbol.RECIPIENT_VALID, Symbol.AMOUNT_VALID, Symbol.AUTH_FAILURE]

    if scenario == SCENARIO_INSUFFICIENT_BALANCE:
        return base + [
            Symbol.RECIPIENT_VALID,
            Symbol.AMOUNT_VALID,
            Symbol.AUTH_SUCCESS,
            Symbol.BALANCE_INSUFFICIENT,
        ]

    if scenario == SCENARIO_PROCESS_FAIL:
        return base + [
            Symbol.RECIPIENT_VALID,
            Symbol.AMOUNT_VALID,
            Symbol.AUTH_SUCCESS,
            Symbol.BALANCE_SUFFICIENT,
            Symbol.PROCESS,
            Symbol.PROCESS_FAILURE,
        ]

    if scenario == SCENARIO_TIMEOUT:
        return base + [
            Symbol.RECIPIENT_VALID,
            Symbol.AMOUNT_VALID,
            Symbol.AUTH_SUCCESS,
            Symbol.BALANCE_SUFFICIENT,
            Symbol.PROCESS,
            Symbol.PROCESS_TIMEOUT,
        ]

    # Default: use actual validation results
    if not recipient_exists:
        return base + [Symbol.RECIPIENT_INVALID]

    if not amount_ok:
        return base + [Symbol.RECIPIENT_VALID, Symbol.AMOUNT_INVALID]

    if not balance_sufficient:
        return base + [
            Symbol.RECIPIENT_VALID,
            Symbol.AMOUNT_VALID,
            Symbol.AUTH_SUCCESS,
            Symbol.BALANCE_INSUFFICIENT,
        ]

    # Full successful path
    return base + [
        Symbol.RECIPIENT_VALID,
        Symbol.AMOUNT_VALID,
        Symbol.AUTH_SUCCESS,
        Symbol.BALANCE_SUFFICIENT,
        Symbol.PROCESS,
        Symbol.PROCESS_SUCCESS,
    ]


def _outcome_reason(
    terminal_state: str,
    scenario: str | None,
    balance_sufficient: bool,
) -> str:
    reasons = {
        State.SUCCESS: "All validations passed; payment processed successfully.",
        State.REJECTED: _rejected_reason(scenario, balance_sufficient),
        State.FAILED: _failed_reason(scenario),
        State.TIMED_OUT: "The payment processor did not respond in time.",
        State.SINK: "An unexpected event sequence caused the automaton to reach the sink state.",
    }
    return reasons.get(terminal_state, "Unknown outcome.")


def _rejected_reason(scenario: str | None, balance_sufficient: bool) -> str:
    if scenario == SCENARIO_INVALID_RECIPIENT:
        return "The recipient UPI ID is not a recognised demo profile."
    if scenario == SCENARIO_INVALID_AMOUNT:
        return "The amount is invalid (zero, negative, or exceeds the simulation limit)."
    if scenario == SCENARIO_INSUFFICIENT_BALANCE or not balance_sufficient:
        return "Insufficient demo balance to complete this transaction."
    return "Transaction rejected due to invalid input."


def _failed_reason(scenario: str | None) -> str:
    if scenario == SCENARIO_AUTH_FAIL:
        return "Demo authentication failed."
    if scenario == SCENARIO_PROCESS_FAIL:
        return "A simulated processing failure occurred at the payment gateway."
    return "Transaction failed."


async def create_transaction(
    db: AsyncSession,
    payload: TransactionCreate,
) -> TransactionOut:
    async with _transaction_lock():
        return await _create_transaction(db, payload)


async def _create_transaction(
    db: AsyncSession,
    payload: TransactionCreate,
) -> TransactionOut:
    """
    Process a simulated payment and persist the result.
    Uses a database transaction to ensure atomicity.
    """
    # ── Idempotency check ────────────────────────────────────────────────────
    if payload.idempotency_key:
        existing = await db.execute(
            select(Transaction).where(Transaction.idempotency_key == payload.idempotency_key)
        )
        existing_txn = existing.scalar_one_or_none()
        if existing_txn is not None:
            return await _build_out(existing_txn, db)

    # ── Business validation ──────────────────────────────────────────────────
    sender_result = await db.execute(
        select(DemoAccount).where(
            DemoAccount.upi_id == settings.demo_sender_upi_id,
            DemoAccount.is_active.is_(True),
        )
    )
    sender = sender_result.scalar_one_or_none()
    if sender is None:
        raise ValueError("Demo sender account not found.")

    recipient_result = await db.execute(
        select(DemoAccount).where(
            DemoAccount.upi_id == payload.recipient_upi_id,
            DemoAccount.is_active.is_(True),
            DemoAccount.is_sender.is_(False),
        )
    )
    recipient = recipient_result.scalar_one_or_none()

    recipient_exists = recipient is not None
    amount_ok = 0 < payload.amount_paise <= MAX_AMOUNT_PAISE

    # ── Build DFA event sequence ─────────────────────────────────────────────
    scenario = (payload.scenario or "").strip().lower() or None
    balance_sufficient = sender.balance_paise >= payload.amount_paise
    sequence = _build_event_sequence(
        scenario,
        recipient_exists,
        amount_ok,
        balance_sufficient,
    )

    # ── Run the DFA engine ───────────────────────────────────────────────────
    result = generate_trace(sequence)

    # ── Determine final status string ────────────────────────────────────────
    status_map = {
        State.SUCCESS: "SUCCESS",
        State.REJECTED: "REJECTED",
        State.FAILED: "FAILED",
        State.TIMED_OUT: "TIMED_OUT",
        State.SINK: "FAILED",
    }
    status = status_map.get(result.terminal_state, "FAILED")
    outcome_reason = _outcome_reason(result.terminal_state, scenario, balance_sufficient)

    # ── Persist everything in a single DB transaction ────────────────────────
    reference = await _next_reference(db)

    txn = Transaction(
        reference=reference,
        sender_upi_id=settings.demo_sender_upi_id,
        recipient_upi_id=payload.recipient_upi_id if recipient_exists else payload.recipient_upi_id,
        amount_paise=payload.amount_paise,
        note=payload.note,
        status=status,
        terminal_state=result.terminal_state,
        scenario=scenario,
        outcome_reason=outcome_reason,
        idempotency_key=payload.idempotency_key,
    )
    db.add(txn)
    await db.flush()  # get txn.id without committing

    # Persist trace steps
    for step in result.trace:
        db.add(
            TransactionTrace(
                transaction_id=txn.id,
                step_number=step.step,
                input_symbol=step.symbol,
                source_state=step.source_state,
                destination_state=step.destination_state,
                explanation=step.explanation,
            )
        )

    # Deduct balance only for successful transactions
    if status == "SUCCESS" and sender is not None and recipient is not None:
        sender.balance_paise -= payload.amount_paise
        db.add(
            BalanceLedger(
                account_upi_id=sender.upi_id,
                transaction_id=txn.id,
                amount_delta_paise=-payload.amount_paise,
                entry_type="DEBIT",
            )
        )
        db.add(
            BalanceLedger(
                account_upi_id=recipient.upi_id,
                transaction_id=txn.id,
                amount_delta_paise=payload.amount_paise,
                entry_type="CREDIT",
            )
        )
        recipient.balance_paise += payload.amount_paise

    await db.commit()
    await db.refresh(txn)

    return await _build_out(txn, db)


async def _build_out(txn: Transaction, db: AsyncSession) -> TransactionOut:
    """Convert a Transaction ORM object into the TransactionOut schema."""
    await db.refresh(txn, ["trace_steps", "recipient_account"])

    trace_out = [
        TraceStepOut(
            step=t.step_number,
            source_state=t.source_state,
            source_label=_state_label(t.source_state),
            symbol=t.input_symbol,
            symbol_label=_symbol_label(t.input_symbol),
            destination_state=t.destination_state,
            destination_label=_state_label(t.destination_state),
            explanation=t.explanation,
        )
        for t in txn.trace_steps
    ]

    recipient_name = (
        txn.recipient_account.display_name if txn.recipient_account else txn.recipient_upi_id
    )

    return TransactionOut(
        id=txn.id,
        reference=txn.reference,
        sender_upi_id=txn.sender_upi_id,
        recipient_upi_id=txn.recipient_upi_id,
        recipient_display_name=recipient_name,
        amount_paise=txn.amount_paise,
        amount_inr=txn.amount_paise / 100,
        note=txn.note,
        status=txn.status,
        terminal_state=txn.terminal_state,
        scenario=txn.scenario,
        outcome_reason=txn.outcome_reason,
        created_at=txn.created_at,
        trace=trace_out,
    )


def _state_label(state: str) -> str:
    from app.dfa.states import STATE_LABELS
    return STATE_LABELS.get(state, state)


def _symbol_label(symbol: str) -> str:
    from app.dfa.alphabet import SYMBOL_LABELS
    return SYMBOL_LABELS.get(symbol, symbol)
