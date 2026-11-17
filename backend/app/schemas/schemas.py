"""
Pydantic request/response schemas for DigiPay-DFA API.
All monetary values are in paise (integer) at the API boundary.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# ── Demo Accounts ──────────────────────────────────────────────────────────────

class DemoAccountOut(BaseModel):
    upi_id: str
    display_name: str
    balance_paise: int
    balance_inr: float
    is_active: bool
    is_sender: bool

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_model(cls, obj) -> "DemoAccountOut":
        return cls(
            upi_id=obj.upi_id,
            display_name=obj.display_name,
            balance_paise=obj.balance_paise,
            balance_inr=obj.balance_paise / 100,
            is_active=obj.is_active,
            is_sender=obj.is_sender,
        )


# ── Transactions ───────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    recipient_upi_id: str = Field(..., description="Fictional demo UPI ID of the recipient")
    amount_paise: int = Field(..., gt=0, description="Amount in paise (must be > 0)")
    note: Optional[str] = Field(None, max_length=256)
    scenario: Optional[str] = Field(None, description="Test scenario label")
    idempotency_key: Optional[str] = Field(None, max_length=64)

    @field_validator("amount_paise")
    @classmethod
    def validate_amount(cls, v: int) -> int:
        from app.core.config import settings
        if v <= 0:
            raise ValueError("Amount must be greater than zero.")
        if v > settings.max_amount_paise:
            raise ValueError(
                f"Amount exceeds the simulation maximum of ₹{settings.max_amount_paise // 100:,}."
            )
        return v

    @field_validator("recipient_upi_id")
    @classmethod
    def validate_recipient_format(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("Recipient UPI ID cannot be empty.")
        return v


class TraceStepOut(BaseModel):
    step: int
    source_state: str
    source_label: str
    symbol: str
    symbol_label: str
    destination_state: str
    destination_label: str
    explanation: str

    model_config = {"from_attributes": True}


class TransactionOut(BaseModel):
    id: int
    reference: str
    sender_upi_id: str
    recipient_upi_id: str
    recipient_display_name: str
    amount_paise: int
    amount_inr: float
    note: Optional[str]
    status: str
    terminal_state: Optional[str]
    scenario: Optional[str]
    outcome_reason: Optional[str]
    created_at: datetime
    trace: list[TraceStepOut] = []

    model_config = {"from_attributes": True}


class TransactionListItem(BaseModel):
    id: int
    reference: str
    sender_upi_id: str
    recipient_upi_id: str
    recipient_display_name: str
    amount_paise: int
    amount_inr: float
    status: str
    terminal_state: Optional[str]
    scenario: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[TransactionListItem]


# ── Dashboard ──────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_transactions: int
    successful: int
    failed: int
    rejected: int
    timed_out: int
    total_amount_paise: int
    total_amount_inr: float
    recent_transactions: list[TransactionListItem]
    sender_balance_paise: int
    sender_balance_inr: float


# ── DFA ───────────────────────────────────────────────────────────────────────

class DFAStateInfo(BaseModel):
    id: str
    label: str
    is_initial: bool
    is_accepting: bool
    is_terminal: bool
    is_sink: bool


class DFASymbolInfo(BaseModel):
    id: str
    label: str


class DFATransitionInfo(BaseModel):
    source: str
    symbol: str
    destination: str


class DFADefinitionOut(BaseModel):
    states: list[DFAStateInfo]
    alphabet: list[DFASymbolInfo]
    initial_state: str
    accepting_states: list[str]
    transitions: list[DFATransitionInfo]


class DFASimulateRequest(BaseModel):
    input_sequence: list[str] = Field(..., min_length=1)


class DFASimulateResponse(BaseModel):
    accepted: bool
    terminal_state: str
    terminal_label: str
    outcome: str
    trace: list[TraceStepOut]


# ── Error ─────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
