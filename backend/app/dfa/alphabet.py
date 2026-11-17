"""
Input alphabet for the DigiPay-DFA.
Each symbol represents a semantic event in the payment transaction lifecycle.
"""

from enum import Enum


class Symbol(str, Enum):
    # Initiation
    START = "START"

    # Recipient validation outcomes
    RECIPIENT_VALID = "RECIPIENT_VALID"
    RECIPIENT_INVALID = "RECIPIENT_INVALID"

    # Amount validation outcomes
    AMOUNT_VALID = "AMOUNT_VALID"
    AMOUNT_INVALID = "AMOUNT_INVALID"

    # Authentication outcomes
    AUTH_SUCCESS = "AUTH_SUCCESS"
    AUTH_FAILURE = "AUTH_FAILURE"

    # Balance check outcomes
    BALANCE_SUFFICIENT = "BALANCE_SUFFICIENT"
    BALANCE_INSUFFICIENT = "BALANCE_INSUFFICIENT"

    # Processing outcomes
    PROCESS = "PROCESS"
    PROCESS_SUCCESS = "PROCESS_SUCCESS"
    PROCESS_FAILURE = "PROCESS_FAILURE"
    PROCESS_TIMEOUT = "PROCESS_TIMEOUT"

    # Reset
    RESET = "RESET"


SYMBOL_LABELS: dict[str, str] = {
    Symbol.START: "Start transaction",
    Symbol.RECIPIENT_VALID: "Recipient is valid",
    Symbol.RECIPIENT_INVALID: "Recipient is invalid",
    Symbol.AMOUNT_VALID: "Amount is valid",
    Symbol.AMOUNT_INVALID: "Amount is invalid",
    Symbol.AUTH_SUCCESS: "Authentication succeeded",
    Symbol.AUTH_FAILURE: "Authentication failed",
    Symbol.BALANCE_SUFFICIENT: "Balance is sufficient",
    Symbol.BALANCE_INSUFFICIENT: "Balance is insufficient",
    Symbol.PROCESS: "Initiate processing",
    Symbol.PROCESS_SUCCESS: "Processing succeeded",
    Symbol.PROCESS_FAILURE: "Processing failed",
    Symbol.PROCESS_TIMEOUT: "Processing timed out",
    Symbol.RESET: "Reset to idle",
}
