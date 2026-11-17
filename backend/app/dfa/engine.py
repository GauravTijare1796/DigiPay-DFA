"""
DigiPay-DFA Engine

Implements the deterministic finite automaton:
  M = (Q, Σ, δ, q0, F)
  Q  = all states in State enum
  Σ  = all symbols in Symbol enum
  δ  = TRANSITION_TABLE
  q0 = State.IDLE
  F  = {State.SUCCESS}

The engine is a pure function with no side effects.
It does not access the database, call external services, or make decisions
about business logic.  Callers are responsible for constructing the correct
input sequence by validating recipient, amount, authentication, and balance
through application services, then feeding the resulting symbols here.
"""

from dataclasses import dataclass, field
from app.dfa.states import (
    State,
    STATE_LABELS,
    ACCEPTING_STATES,
    TERMINAL_STATES,
    INITIAL_STATE,
)
from app.dfa.alphabet import Symbol, SYMBOL_LABELS
from app.dfa.transitions import TRANSITION_TABLE


@dataclass
class TraceStep:
    step: int
    source_state: str
    source_label: str
    symbol: str
    symbol_label: str
    destination_state: str
    destination_label: str
    explanation: str


@dataclass
class RunResult:
    accepted: bool
    terminal_state: str
    terminal_label: str
    trace: list[TraceStep] = field(default_factory=list)
    is_sink: bool = False

    @property
    def outcome(self) -> str:
        """Human-readable outcome."""
        if self.terminal_state == State.SUCCESS:
            return "Transaction completed successfully."
        if self.terminal_state == State.REJECTED:
            return "Transaction rejected due to invalid input."
        if self.terminal_state == State.FAILED:
            return "Transaction failed (authentication failure or processing error)."
        if self.terminal_state == State.TIMED_OUT:
            return "Transaction timed out during processing."
        if self.terminal_state == State.SINK:
            return "Invalid event sequence — automaton reached sink state."
        return "Unknown outcome."


def initial_state() -> str:
    return INITIAL_STATE


def transition(current_state: str, symbol: str) -> str:
    """
    δ(current_state, symbol) → next_state

    Returns the next state according to the transition table.
    If the combination is not found (which should not happen in a total DFA),
    falls back to the SINK state.
    """
    state_row = TRANSITION_TABLE.get(current_state)
    if state_row is None:
        return State.SINK
    return state_row.get(symbol, State.SINK)


def is_accepting(state: str) -> bool:
    return state in ACCEPTING_STATES


def is_terminal(state: str) -> bool:
    return state in TERMINAL_STATES


def _make_explanation(source: str, symbol: str, dest: str) -> str:
    """Produce a human-readable explanation for a single transition."""
    src_label = STATE_LABELS.get(source, source)
    sym_label = SYMBOL_LABELS.get(symbol, symbol)
    dst_label = STATE_LABELS.get(dest, dest)
    return f"In state '{src_label}', event '{sym_label}' → move to '{dst_label}'."


def generate_trace(input_sequence: list[str]) -> RunResult:
    """
    Run the DFA over the complete input sequence and return a full trace.

    Processing halts when a terminal state is reached.  Any remaining symbols
    in the sequence are not consumed (the automaton has stopped).
    """
    current = INITIAL_STATE
    trace: list[TraceStep] = []

    for step_num, symbol in enumerate(input_sequence, start=1):
        next_st = transition(current, symbol)
        explanation = _make_explanation(current, symbol, next_st)

        trace.append(
            TraceStep(
                step=step_num,
                source_state=current,
                source_label=STATE_LABELS.get(current, current),
                symbol=symbol,
                symbol_label=SYMBOL_LABELS.get(symbol, symbol),
                destination_state=next_st,
                destination_label=STATE_LABELS.get(next_st, next_st),
                explanation=explanation,
            )
        )

        current = next_st

        # Stop consuming once a terminal state is reached
        if is_terminal(current):
            break

    accepted = is_accepting(current)
    return RunResult(
        accepted=accepted,
        terminal_state=current,
        terminal_label=STATE_LABELS.get(current, current),
        trace=trace,
        is_sink=(current == State.SINK),
    )


def run(input_sequence: list[str]) -> str:
    """Return only the terminal state after running the sequence."""
    return generate_trace(input_sequence).terminal_state


def validate_sequence(input_sequence: list[str]) -> tuple[bool, str]:
    """
    Check whether the sequence leads to an accepting state.
    Returns (is_valid, terminal_state).
    """
    result = generate_trace(input_sequence)
    return result.accepted, result.terminal_state


def get_definition() -> dict:
    """
    Return the formal five-tuple definition as a serialisable dict.
    Used by the API endpoint so the frontend can render the diagram
    from the same canonical source.
    """
    from app.dfa.alphabet import Symbol

    states = [
        {
            "id": s.value,
            "label": STATE_LABELS[s],
            "is_initial": s == State.IDLE,
            "is_accepting": s.value in ACCEPTING_STATES,
            "is_terminal": s.value in TERMINAL_STATES,
            "is_sink": s == State.SINK,
        }
        for s in State
    ]

    alphabet = [
        {"id": sym.value, "label": SYMBOL_LABELS[sym]}
        for sym in Symbol
    ]

    # Flatten the transition table for the API
    transitions = []
    for src_state, row in TRANSITION_TABLE.items():
        for sym, dst_state in row.items():
            transitions.append(
                {
                    "source": src_state,
                    "symbol": sym,
                    "destination": dst_state,
                }
            )

    return {
        "states": states,
        "alphabet": alphabet,
        "initial_state": INITIAL_STATE,
        "accepting_states": list(ACCEPTING_STATES),
        "transitions": transitions,
    }
