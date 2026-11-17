# DFA Specification — DigiPay-DFA

## 1. Formal Five-Tuple

**M = (Q, Σ, δ, q₀, F)**

| Component | Value |
|-----------|-------|
| Q  | {q0, q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11, q12, q13} |
| Σ  | See Section 3 |
| δ  | See Section 4 |
| q₀ | q0 (IDLE) |
| F  | {q9} (SUCCESS only) |

---

## 2. State Set Q

| ID  | Name                    | Type        |
|-----|-------------------------|-------------|
| q0  | IDLE                    | Initial     |
| q1  | RECIPIENT_ENTERED       | Intermediate|
| q2  | RECIPIENT_VALIDATED     | Intermediate|
| q3  | AMOUNT_ENTERED          | Intermediate|
| q4  | AMOUNT_VALIDATED        | Intermediate|
| q5  | AUTHENTICATION_PENDING  | Intermediate|
| q6  | AUTHENTICATION_VALIDATED| Intermediate|
| q7  | BALANCE_CHECK           | Intermediate|
| q8  | PROCESSING              | Intermediate|
| q9  | SUCCESS                 | **Accepting / Terminal** |
| q10 | REJECTED                | Terminal    |
| q11 | FAILED                  | Terminal    |
| q12 | TIMED_OUT               | Terminal    |
| q13 | SINK                    | Dead / Terminal |

---

## 3. Input Alphabet Σ

| Symbol                | Description                          |
|-----------------------|--------------------------------------|
| START                 | Initiate a transaction               |
| RECIPIENT_VALID       | Recipient exists in demo profiles    |
| RECIPIENT_INVALID     | Recipient is not recognised          |
| AMOUNT_VALID          | Amount passes all validation rules   |
| AMOUNT_INVALID        | Amount is zero, negative, or too large |
| AUTH_SUCCESS          | Demo authentication passed           |
| AUTH_FAILURE          | Demo authentication failed           |
| BALANCE_SUFFICIENT    | Sender has enough demo balance       |
| BALANCE_INSUFFICIENT  | Sender balance too low               |
| PROCESS               | Initiate payment processing          |
| PROCESS_SUCCESS       | Processing completed successfully    |
| PROCESS_FAILURE       | Processing encountered an error      |
| PROCESS_TIMEOUT       | Processing did not complete in time  |
| RESET                 | Reset automaton to initial state     |

---

## 4. Transition Function δ (Selected rows)

| State (q) | Symbol (a)           | δ(q, a)   |
|-----------|----------------------|-----------|
| q0        | START                | q1        |
| q1        | RECIPIENT_VALID      | q2        |
| q1        | RECIPIENT_INVALID    | q10       |
| q2        | AMOUNT_VALID         | q4        |
| q2        | AMOUNT_INVALID       | q10       |
| q4        | AUTH_SUCCESS         | q6        |
| q4        | AUTH_FAILURE         | q11       |
| q6        | BALANCE_SUFFICIENT   | q7        |
| q6        | BALANCE_INSUFFICIENT | q10       |
| q7        | PROCESS              | q8        |
| q8        | PROCESS_SUCCESS      | q9        |
| q8        | PROCESS_FAILURE      | q11       |
| q8        | PROCESS_TIMEOUT      | q12       |
| any       | RESET                | q0        |
| any (undefined) | any event     | q13 (SINK)|

The complete transition table (196 entries) is in `backend/app/dfa/transitions.py`
and is served by the API at `GET /api/dfa/definition`.

---

## 5. Total DFA and Sink State

DigiPay-DFA is a **total DFA**: δ is defined for every (state, symbol) pair.
The SINK state (q13) absorbs all undefined transitions, making the automaton total.
SINK is a dead state — all symbols except RESET loop back to SINK.
This ensures the automaton never gets stuck.

---

## 6. Example Accepted Sequence

```
START, RECIPIENT_VALID, AMOUNT_VALID, AUTH_SUCCESS, BALANCE_SUFFICIENT, PROCESS, PROCESS_SUCCESS
```

State path: q0 → q1 → q2 → q4 → q6 → q7 → q8 → **q9** ✓ (accepted)

---

## 7. Example Rejected Sequences

| Scenario              | Input sequence                                                 | Terminal state |
|-----------------------|----------------------------------------------------------------|----------------|
| Invalid recipient     | START, RECIPIENT_INVALID                                       | q10 (REJECTED) |
| Invalid amount        | START, RECIPIENT_VALID, AMOUNT_INVALID                         | q10 (REJECTED) |
| Auth failure          | START, RECIPIENT_VALID, AMOUNT_VALID, AUTH_FAILURE             | q11 (FAILED)   |
| Insufficient balance  | START, …, AUTH_SUCCESS, BALANCE_INSUFFICIENT                  | q10 (REJECTED) |
| Process failure       | START, …, PROCESS, PROCESS_FAILURE                            | q11 (FAILED)   |
| Timeout               | START, …, PROCESS, PROCESS_TIMEOUT                            | q12 (TIMED_OUT)|
| Malformed sequence    | AMOUNT_VALID, START                                            | q13 (SINK)     |
