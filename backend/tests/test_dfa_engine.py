"""
Unit tests for the DFA engine.

These tests verify:
- Initial state
- Individual transition correctness
- Determinism
- Totality (every state/symbol pair is defined)
- Accepted and rejected sequences
- Terminal state behaviour
- Sink state behaviour
"""

import pytest
from app.dfa.engine import (
    initial_state,
    transition,
    generate_trace,
    is_accepting,
    is_terminal,
)
from app.dfa.states import State, ACCEPTING_STATES, TERMINAL_STATES, INITIAL_STATE
from app.dfa.alphabet import Symbol
from app.dfa.transitions import TRANSITION_TABLE


# ── Basic state properties ─────────────────────────────────────────────────────

def test_initial_state():
    assert initial_state() == State.IDLE


def test_accepting_states_contains_only_success():
    assert ACCEPTING_STATES == {State.SUCCESS}


def test_terminal_states():
    expected = {State.SUCCESS, State.REJECTED, State.FAILED, State.TIMED_OUT, State.SINK}
    assert TERMINAL_STATES == expected


# ── Totality: every state has an entry for every symbol ───────────────────────

def test_transition_table_is_total():
    """
    A total DFA requires δ(q, a) to be defined for every q ∈ Q and every a ∈ Σ.
    """
    all_states = list(State)
    all_symbols = list(Symbol)
    for state in all_states:
        assert state in TRANSITION_TABLE, f"State {state} missing from transition table"
        for symbol in all_symbols:
            assert symbol in TRANSITION_TABLE[state], (
                f"Transition δ({state}, {symbol}) is undefined"
            )


# ── Determinism: each (state, symbol) pair maps to exactly one next state ─────

def test_transition_table_is_deterministic():
    """Each entry in the table must be a single state value, not a list."""
    for state, row in TRANSITION_TABLE.items():
        for symbol, next_st in row.items():
            assert isinstance(next_st, str), (
                f"δ({state}, {symbol}) should be a single str, got {type(next_st)}"
            )
            # The destination must be a valid State
            valid_states = {s.value for s in State}
            assert next_st in valid_states, (
                f"δ({state}, {symbol}) = '{next_st}' is not a recognised state"
            )


# ── Individual transitions ─────────────────────────────────────────────────────

def test_idle_start_goes_to_recipient_entered():
    assert transition(State.IDLE, Symbol.START) == State.RECIPIENT_ENTERED


def test_recipient_entered_valid_goes_to_recipient_validated():
    assert transition(State.RECIPIENT_ENTERED, Symbol.RECIPIENT_VALID) == State.RECIPIENT_VALIDATED


def test_recipient_entered_invalid_goes_to_rejected():
    assert transition(State.RECIPIENT_ENTERED, Symbol.RECIPIENT_INVALID) == State.REJECTED


def test_recipient_validated_amount_valid_goes_to_amount_validated():
    assert transition(State.RECIPIENT_VALIDATED, Symbol.AMOUNT_VALID) == State.AMOUNT_VALIDATED


def test_recipient_validated_amount_invalid_goes_to_rejected():
    assert transition(State.RECIPIENT_VALIDATED, Symbol.AMOUNT_INVALID) == State.REJECTED


def test_amount_validated_auth_success_goes_to_auth_validated():
    assert transition(State.AMOUNT_VALIDATED, Symbol.AUTH_SUCCESS) == State.AUTHENTICATION_VALIDATED


def test_amount_validated_auth_failure_goes_to_failed():
    assert transition(State.AMOUNT_VALIDATED, Symbol.AUTH_FAILURE) == State.FAILED


def test_auth_validated_balance_sufficient_goes_to_balance_check():
    assert transition(State.AUTHENTICATION_VALIDATED, Symbol.BALANCE_SUFFICIENT) == State.BALANCE_CHECK


def test_auth_validated_balance_insufficient_goes_to_rejected():
    assert transition(State.AUTHENTICATION_VALIDATED, Symbol.BALANCE_INSUFFICIENT) == State.REJECTED


def test_balance_check_process_goes_to_processing():
    assert transition(State.BALANCE_CHECK, Symbol.PROCESS) == State.PROCESSING


def test_processing_success_goes_to_success():
    assert transition(State.PROCESSING, Symbol.PROCESS_SUCCESS) == State.SUCCESS


def test_processing_failure_goes_to_failed():
    assert transition(State.PROCESSING, Symbol.PROCESS_FAILURE) == State.FAILED


def test_processing_timeout_goes_to_timed_out():
    assert transition(State.PROCESSING, Symbol.PROCESS_TIMEOUT) == State.TIMED_OUT


def test_sink_absorbs_all_symbols():
    for symbol in Symbol:
        if symbol == Symbol.RESET:
            assert transition(State.SINK, symbol) == State.IDLE
        else:
            assert transition(State.SINK, symbol) == State.SINK


def test_terminal_states_go_to_sink_on_non_reset():
    terminal = [State.SUCCESS, State.REJECTED, State.FAILED, State.TIMED_OUT]
    for state in terminal:
        for symbol in Symbol:
            if symbol == Symbol.RESET:
                assert transition(state, symbol) == State.IDLE
            else:
                assert transition(state, symbol) == State.SINK


# ── Full sequence tests ────────────────────────────────────────────────────────

SUCCESSFUL_SEQUENCE = [
    Symbol.START,
    Symbol.RECIPIENT_VALID,
    Symbol.AMOUNT_VALID,
    Symbol.AUTH_SUCCESS,
    Symbol.BALANCE_SUFFICIENT,
    Symbol.PROCESS,
    Symbol.PROCESS_SUCCESS,
]

INVALID_RECIPIENT_SEQUENCE = [Symbol.START, Symbol.RECIPIENT_INVALID]
INVALID_AMOUNT_SEQUENCE = [Symbol.START, Symbol.RECIPIENT_VALID, Symbol.AMOUNT_INVALID]
AUTH_FAIL_SEQUENCE = [Symbol.START, Symbol.RECIPIENT_VALID, Symbol.AMOUNT_VALID, Symbol.AUTH_FAILURE]
INSUFFICIENT_BALANCE_SEQUENCE = [
    Symbol.START, Symbol.RECIPIENT_VALID, Symbol.AMOUNT_VALID,
    Symbol.AUTH_SUCCESS, Symbol.BALANCE_INSUFFICIENT,
]
PROCESS_FAIL_SEQUENCE = [
    Symbol.START, Symbol.RECIPIENT_VALID, Symbol.AMOUNT_VALID,
    Symbol.AUTH_SUCCESS, Symbol.BALANCE_SUFFICIENT, Symbol.PROCESS, Symbol.PROCESS_FAILURE,
]
TIMEOUT_SEQUENCE = [
    Symbol.START, Symbol.RECIPIENT_VALID, Symbol.AMOUNT_VALID,
    Symbol.AUTH_SUCCESS, Symbol.BALANCE_SUFFICIENT, Symbol.PROCESS, Symbol.PROCESS_TIMEOUT,
]
MALFORMED_SEQUENCE = [Symbol.AMOUNT_VALID, Symbol.START]


def test_successful_sequence_is_accepted():
    result = generate_trace(SUCCESSFUL_SEQUENCE)
    assert result.accepted is True
    assert result.terminal_state == State.SUCCESS


def test_successful_sequence_trace_length():
    result = generate_trace(SUCCESSFUL_SEQUENCE)
    assert len(result.trace) == len(SUCCESSFUL_SEQUENCE)


def test_invalid_recipient_is_rejected():
    result = generate_trace(INVALID_RECIPIENT_SEQUENCE)
    assert result.accepted is False
    assert result.terminal_state == State.REJECTED


def test_invalid_amount_is_rejected():
    result = generate_trace(INVALID_AMOUNT_SEQUENCE)
    assert result.accepted is False
    assert result.terminal_state == State.REJECTED


def test_auth_failure_leads_to_failed():
    result = generate_trace(AUTH_FAIL_SEQUENCE)
    assert result.accepted is False
    assert result.terminal_state == State.FAILED


def test_insufficient_balance_is_rejected():
    result = generate_trace(INSUFFICIENT_BALANCE_SEQUENCE)
    assert result.accepted is False
    assert result.terminal_state == State.REJECTED


def test_process_failure_leads_to_failed():
    result = generate_trace(PROCESS_FAIL_SEQUENCE)
    assert result.accepted is False
    assert result.terminal_state == State.FAILED


def test_timeout_leads_to_timed_out():
    result = generate_trace(TIMEOUT_SEQUENCE)
    assert result.accepted is False
    assert result.terminal_state == State.TIMED_OUT


def test_malformed_sequence_leads_to_sink():
    result = generate_trace(MALFORMED_SEQUENCE)
    assert result.terminal_state == State.SINK
    assert result.is_sink is True


def test_trace_stops_at_terminal_state():
    """
    The engine should halt once a terminal state is reached.
    Extra symbols after a terminal state must not be consumed.
    """
    seq = INVALID_RECIPIENT_SEQUENCE + [Symbol.AMOUNT_VALID, Symbol.AUTH_SUCCESS]
    result = generate_trace(seq)
    # Should stop at REJECTED (step 2) and not process further symbols
    assert result.terminal_state == State.REJECTED
    assert len(result.trace) == 2


def test_reset_from_rejected_returns_to_idle():
    next_st = transition(State.REJECTED, Symbol.RESET)
    assert next_st == State.IDLE


def test_is_accepting_for_success():
    assert is_accepting(State.SUCCESS) is True


def test_is_not_accepting_for_failed():
    assert is_accepting(State.FAILED) is False


def test_is_terminal_for_all_terminal_states():
    for state in [State.SUCCESS, State.REJECTED, State.FAILED, State.TIMED_OUT, State.SINK]:
        assert is_terminal(state) is True


def test_is_not_terminal_for_intermediate_states():
    for state in [State.IDLE, State.RECIPIENT_ENTERED, State.PROCESSING]:
        assert is_terminal(state) is False
