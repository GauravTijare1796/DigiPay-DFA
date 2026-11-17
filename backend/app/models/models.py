"""
SQLAlchemy ORM models for DigiPay-DFA.

Tables:
  demo_accounts      — fictional sender/recipient profiles with demo balances
  transactions       — simulated payment records
  transaction_traces — DFA state-transition steps per transaction
  balance_ledger     — immutable ledger of balance changes
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DemoAccount(Base):
    __tablename__ = "demo_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upi_id = Column(String(64), nullable=False, unique=True, index=True)
    display_name = Column(String(128), nullable=False)
    # Balance stored in paise (1 INR = 100 paise) to avoid floating-point errors
    balance_paise = Column(BigInteger, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    is_sender = Column(Boolean, nullable=False, default=False)  # True for the demo user
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    sent_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.sender_upi_id",
        back_populates="sender_account",
    )
    received_transactions = relationship(
        "Transaction",
        foreign_keys="Transaction.recipient_upi_id",
        back_populates="recipient_account",
    )
    ledger_entries = relationship("BalanceLedger", back_populates="account")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Human-readable reference like TXN-20260001
    reference = Column(String(32), nullable=False, unique=True, index=True)
    sender_upi_id = Column(String(64), ForeignKey("demo_accounts.upi_id"), nullable=False)
    recipient_upi_id = Column(String(64), ForeignKey("demo_accounts.upi_id"), nullable=False)
    amount_paise = Column(BigInteger, nullable=False)
    note = Column(String(256), nullable=True)
    # Final status: SUCCESS | REJECTED | FAILED | TIMED_OUT | SINK
    status = Column(String(32), nullable=False, default="PENDING")
    terminal_state = Column(String(8), nullable=True)  # q9, q10, q11, q12, q13
    scenario = Column(String(64), nullable=True)        # test scenario label
    outcome_reason = Column(String(256), nullable=True)
    idempotency_key = Column(String(64), nullable=True, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    sender_account = relationship(
        "DemoAccount",
        foreign_keys=[sender_upi_id],
        back_populates="sent_transactions",
    )
    recipient_account = relationship(
        "DemoAccount",
        foreign_keys=[recipient_upi_id],
        back_populates="received_transactions",
    )
    trace_steps = relationship(
        "TransactionTrace",
        back_populates="transaction",
        order_by="TransactionTrace.step_number",
        cascade="all, delete-orphan",
    )
    ledger_entries = relationship(
        "BalanceLedger",
        back_populates="transaction",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_transactions_status", "status"),
        Index("ix_transactions_created_at", "created_at"),
    )


class TransactionTrace(Base):
    __tablename__ = "transaction_traces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    input_symbol = Column(String(32), nullable=False)
    source_state = Column(String(8), nullable=False)
    destination_state = Column(String(8), nullable=False)
    explanation = Column(String(512), nullable=False)

    transaction = relationship("Transaction", back_populates="trace_steps")

    __table_args__ = (
        UniqueConstraint("transaction_id", "step_number", name="uq_trace_step"),
    )


class BalanceLedger(Base):
    __tablename__ = "balance_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    account_upi_id = Column(String(64), ForeignKey("demo_accounts.upi_id"), nullable=False, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, index=True)
    # Negative for debit, positive for credit (in paise)
    amount_delta_paise = Column(BigInteger, nullable=False)
    entry_type = Column(String(32), nullable=False)   # DEBIT | CREDIT
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    account = relationship("DemoAccount", back_populates="ledger_entries")
    transaction = relationship("Transaction", back_populates="ledger_entries")
