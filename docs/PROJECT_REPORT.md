# Project Report — DigiPay-DFA

## Abstract

DigiPay-DFA is a web application that demonstrates the practical application of
Deterministic Finite Automata (DFA) from the Theory of Computation to a simulated
digital payment transaction lifecycle. The backend implements a formally specified
DFA engine that deterministically processes every transaction through a defined
sequence of states and transitions. The frontend provides a payment simulator,
an interactive step-by-step DFA executor, and a state diagram rendered from the
canonical automaton definition. All transaction outcomes are determined exclusively
by the DFA engine — no outcome is hardcoded independently of the automaton.

---

## 1. Introduction

Theory of Computation (ToC) establishes formal models of computation. The
Deterministic Finite Automaton (DFA) is one of the simplest such models, yet it
is expressive enough to model real-world sequential processes. Digital payment
systems are sequential by nature: a transaction moves through a defined series of
stages (validation → authentication → processing → settlement) with clear
accept/reject criteria at each stage.

DigiPay-DFA maps this lifecycle onto a formal DFA, providing a concrete,
runnable illustration of ToC concepts with a familiar domain.

---

## 2. Problem Statement

Most ToC coursework presents DFAs through abstract string-acceptance examples
(e.g. "strings over {a,b} with an even number of a's"). This leaves students
without a concrete, relatable application. DigiPay-DFA bridges this gap by
modelling a payment transaction as a formal language and implementing a real,
running DFA engine that decides it.

---

## 3. Objectives

1. Define a formally correct DFA (five-tuple) for the payment transaction lifecycle.
2. Implement the DFA as a software engine with a verifiable transition table.
3. Build a full-stack web application driven by this engine.
4. Demonstrate all DFA paths through seven testable scenarios.
5. Provide an interactive step-by-step simulator for viva demonstration.
6. Back all claims with automated tests (58 backend + 25 frontend).

---

## 4. Scope and Limitations

**In scope:** DFA modelling, transaction simulation, state diagram, transition table,
demo balances, transaction history, automated tests.

**Out of scope:** Real UPI/NPCI integration, actual bank accounts, production security,
multi-user authentication, concurrency at scale.

---

## 5. Functional Requirements

- FR1: User can select a demo recipient and enter a simulated amount.
- FR2: User can select a test scenario to exercise any DFA path.
- FR3: Every transaction is processed by the DFA engine; outcome is determined by terminal state.
- FR4: Transition trace is persisted and viewable per transaction.
- FR5: Dashboard shows statistics calculated from actual database records.
- FR6: Interactive simulator allows step-by-step execution of any event sequence.
- FR7: DFA state diagram is rendered from the canonical backend definition.
- FR8: Demo balances are debited only on successful transactions.
- FR9: Idempotency key prevents duplicate deductions on retried requests.

---

## 6. System Architecture

```
Browser (React + Vite)
      ↕ HTTP/JSON (proxied via Vite dev server)
FastAPI (Python)
  ├── API Routes       ← request/response, validation
  ├── Services         ← business logic, event sequence construction
  ├── DFA Engine       ← pure transition function, no side effects
  ├── SQLAlchemy ORM   ← models, sessions
  └── SQLite Database  ← transactions, traces, balances
```

The DFA engine is a pure module with no database or HTTP dependencies. Services
construct the event sequence from validated business data, run the engine, and
persist the result atomically.

---

## 7. Database Design

| Table             | Key Columns                                            |
|-------------------|--------------------------------------------------------|
| demo_accounts     | upi_id (PK), display_name, balance_paise, is_sender    |
| transactions      | id, reference, sender_upi_id, recipient_upi_id, amount_paise, status, terminal_state, idempotency_key |
| transaction_traces| id, transaction_id, step_number, input_symbol, source_state, destination_state |
| balance_ledger    | id, account_upi_id, transaction_id, amount_delta_paise, entry_type |

---

## 8. DFA Mathematical Model

See `DFA_SPECIFICATION.md` for the full five-tuple, state set, alphabet,
transition table, and example sequences.

Key points:
- M = (Q, Σ, δ, q₀, F) with |Q| = 14, |Σ| = 14, |δ| = 196
- Total DFA: δ is defined for every (state, symbol) pair
- F = {q9} — only SUCCESS is accepting
- q13 (SINK) is the dead state for invalid event sequences

---

## 9. Test Cases and Results

### Backend — DFA Engine (35 tests)

| Test | Result |
|------|--------|
| Initial state is q0 | PASS |
| Transition table is total (196 entries) | PASS |
| Transition table is deterministic | PASS |
| Successful sequence accepted (q9) | PASS |
| Invalid recipient → q10 | PASS |
| Invalid amount → q10 | PASS |
| Auth failure → q11 | PASS |
| Insufficient balance → q10 | PASS |
| Process failure → q11 | PASS |
| Timeout → q12 | PASS |
| Malformed sequence → q13 (SINK) | PASS |
| Trace halts at terminal state | PASS |
| RESET from any terminal → q0 | PASS |
| All 13 individual transition checks | PASS |

### Backend — API (23 tests)

| Test | Result |
|------|--------|
| Health endpoint | PASS |
| DFA definition returns 14 states | PASS |
| DFA simulate success | PASS |
| DFA simulate invalid symbol → 422 | PASS |
| Valid transaction → SUCCESS | PASS |
| All 6 failure scenarios | PASS |
| Zero/negative/excessive amount → 422 | PASS |
| Successful transaction debits balance | PASS |
| Failed transaction does NOT debit | PASS |
| Idempotency prevents duplicate deduction | PASS |
| Transaction list and detail | PASS |
| Dashboard summary counts | PASS |

### Frontend (25 tests)

| Test | Result |
|------|--------|
| Form renders correctly | PASS |
| Disclaimer notice present | PASS |
| Recipient dropdown populated from API | PASS |
| Validation: no recipient | PASS |
| Validation: zero amount | PASS |
| Validation: amount exceeds limit | PASS |
| createTransaction called on valid submit | PASS |
| Success result displayed | PASS |
| Failure result displayed | PASS |
| formatINR, statusLabel, statusClass, stateClass | PASS (16) |

**Total: 83 tests, 83 passed.**

---

## 10. Limitations

- Local development only; not production-hardened.
- No real UPI, NPCI, or banking integration.
- The DFA models the lifecycle semantically; real UPI systems are more complex.
- Single-user demo; no multi-user isolation.

---

## 11. Future Scope

- Add a network graph library (e.g. React Flow) for a fully interactive diagram.
- Support for multiple concurrent demo senders.
- Export transaction report as PDF.
- Add rate limiting and request throttling to the API.
- Deploy with Docker Compose for easier sharing.

---

## 12. Conclusion

DigiPay-DFA successfully demonstrates that a formal DFA can model a real-world
sequential process. The DFA engine processes every transaction deterministically,
all seven scenario paths produce the formally expected terminal states, and the
83-test suite verifies correctness at every layer. The application is suitable
for a TY project demonstration and viva.

---

## 13. References

1. Sipser, M. (2012). *Introduction to the Theory of Computation* (3rd ed.). Cengage.
2. Hopcroft, J., Motwani, R., & Ullman, J. (2006). *Introduction to Automata Theory, Languages, and Computation* (3rd ed.). Pearson.
3. FastAPI Documentation — https://fastapi.tiangolo.com
4. React Documentation — https://react.dev
5. SQLAlchemy Documentation — https://docs.sqlalchemy.org
6. NPCI UPI Product Overview — https://www.npci.org.in/what-we-do/upi/product-overview
