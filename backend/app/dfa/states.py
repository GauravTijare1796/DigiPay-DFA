"""
DFA State definitions for DigiPay-DFA.
Each state represents a stage in the simulated payment transaction lifecycle.
"""

from enum import Enum


class State(str, Enum):
    # Normal processing states
    IDLE = "q0"
    RECIPIENT_ENTERED = "q1"
    RECIPIENT_VALIDATED = "q2"
    AMOUNT_ENTERED = "q3"
    AMOUNT_VALIDATED = "q4"
    AUTHENTICATION_PENDING = "q5"
    AUTHENTICATION_VALIDATED = "q6"
    BALANCE_CHECK = "q7"
    PROCESSING = "q8"

    # Terminal accepting state
    SUCCESS = "q9"

    # Terminal rejection/failure states
    REJECTED = "q10"
    FAILED = "q11"
    TIMED_OUT = "q12"

    # Sink state (total DFA — catches all undefined transitions)
    SINK = "q13"


# Human-readable labels for each state
STATE_LABELS: dict[str, str] = {
    State.IDLE: "Idle",
    State.RECIPIENT_ENTERED: "Recipient Entered",
    State.RECIPIENT_VALIDATED: "Recipient Validated",
    State.AMOUNT_ENTERED: "Amount Entered",
    State.AMOUNT_VALIDATED: "Amount Validated",
    State.AUTHENTICATION_PENDING: "Authentication Pending",
    State.AUTHENTICATION_VALIDATED: "Authentication Validated",
    State.BALANCE_CHECK: "Balance Check",
    State.PROCESSING: "Processing",
    State.SUCCESS: "Success",
    State.REJECTED: "Rejected",
    State.FAILED: "Failed",
    State.TIMED_OUT: "Timed Out",
    State.SINK: "Sink (Invalid)",
}

# Accepting states — transactions that complete successfully
ACCEPTING_STATES: set[str] = {State.SUCCESS}

# Terminal states — no further transitions occur from these
TERMINAL_STATES: set[str] = {
    State.SUCCESS,
    State.REJECTED,
    State.FAILED,
    State.TIMED_OUT,
    State.SINK,
}

# Initial state
INITIAL_STATE: str = State.IDLE
