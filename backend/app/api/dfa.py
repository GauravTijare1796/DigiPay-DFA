"""
DFA API endpoints.

GET  /api/dfa/definition   — Returns the full five-tuple definition as JSON.
GET  /api/dfa/transitions  — Returns the flat transition table.
POST /api/dfa/simulate     — Runs the DFA on a user-supplied event sequence.
"""

from fastapi import APIRouter
from app.dfa.engine import get_definition, generate_trace
from app.dfa.alphabet import Symbol, SYMBOL_LABELS
from app.schemas.schemas import (
    DFADefinitionOut,
    DFASimulateRequest,
    DFASimulateResponse,
    TraceStepOut,
)

router = APIRouter(prefix="/dfa", tags=["dfa"])


@router.get("/definition", response_model=DFADefinitionOut)
async def get_dfa_definition():
    """
    Return the complete formal DFA definition:
    states, alphabet, initial state, accepting states, and all transitions.
    The frontend uses this to render the state diagram and transition table.
    """
    return get_definition()


@router.get("/transitions")
async def get_transitions():
    """
    Return only the transition table as a flat list for quick reference.
    """
    defn = get_definition()
    return {"transitions": defn["transitions"]}


@router.get("/alphabet")
async def get_alphabet():
    """Return the input alphabet with labels."""
    return {
        "alphabet": [
            {"id": sym.value, "label": SYMBOL_LABELS[sym]} for sym in Symbol
        ]
    }


@router.post("/simulate", response_model=DFASimulateResponse)
async def simulate_dfa(body: DFASimulateRequest):
    """
    Run the DFA engine on a user-supplied sequence of input symbols.
    Returns the full transition trace and the terminal outcome.
    This endpoint is for the interactive step-by-step simulator.
    """
    # Validate all symbols are in the alphabet
    valid_symbols = {s.value for s in Symbol}
    for sym in body.input_sequence:
        if sym not in valid_symbols:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail=f"'{sym}' is not a valid input symbol. Valid symbols: {sorted(valid_symbols)}",
            )

    result = generate_trace(body.input_sequence)

    trace_out = [
        TraceStepOut(
            step=t.step,
            source_state=t.source_state,
            source_label=t.source_label,
            symbol=t.symbol,
            symbol_label=t.symbol_label,
            destination_state=t.destination_state,
            destination_label=t.destination_label,
            explanation=t.explanation,
        )
        for t in result.trace
    ]

    return DFASimulateResponse(
        accepted=result.accepted,
        terminal_state=result.terminal_state,
        terminal_label=result.terminal_label,
        outcome=result.outcome,
        trace=trace_out,
    )
