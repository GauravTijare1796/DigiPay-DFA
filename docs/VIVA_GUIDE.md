# Viva Guide — DigiPay-DFA

Concise answers for common viva questions.

---

**Q: What is a DFA?**
A DFA (Deterministic Finite Automaton) is a 5-tuple M = (Q, Σ, δ, q₀, F) where Q is a finite set
of states, Σ is the input alphabet, δ: Q × Σ → Q is the transition function, q₀ is the initial
state, and F ⊆ Q is the set of accepting states. It reads one symbol at a time and makes exactly
one deterministic transition per symbol.

---

**Q: Why is this a DFA and not an NFA?**
Every (state, symbol) pair maps to exactly one next state — no ambiguity and no epsilon transitions.
That makes it deterministic. The transition table has 14 × 14 = 196 entries, all explicitly defined.

---

**Q: What are the accepting states?**
Only q9 (SUCCESS). A transaction is "accepted" only when it completes successfully. All other
terminal states (REJECTED, FAILED, TIMED_OUT, SINK) are non-accepting.

---

**Q: What is the SINK state (q13)?**
It is the dead state that makes the DFA total. Any out-of-order or undefined event sends the
automaton to q13, where it stays for all subsequent symbols (except RESET). This is distinct from
a business rejection — SINK means the event sequence itself was structurally invalid.

---

**Q: How does the scenario selector work?**
It is a testing aid that tells the backend service which DFA event sequence to construct. The
DFA engine itself always processes the sequence deterministically — the scenario just controls
which symbols are sent to the engine. The backend never lets the frontend override the outcome.

---

**Q: What happens to the balance on a failed transaction?**
Nothing. The balance deduction is inside a database transaction that only executes when the
DFA engine returns terminal state q9 (SUCCESS). For any other terminal state, no ledger entry
is created. This is enforced transactionally — partial updates cannot occur.

---

**Q: How is idempotency handled?**
A client can supply an `idempotency_key`. Before creating a new transaction, the service checks
whether a transaction with that key already exists. If it does, it returns the existing record
without running the DFA or touching balances again. This prevents double-deductions from
network retries or double-clicks.

---

**Q: What is the transition function for q8 (PROCESSING)?**
- δ(q8, PROCESS_SUCCESS) = q9 (SUCCESS)
- δ(q8, PROCESS_FAILURE) = q11 (FAILED)
- δ(q8, PROCESS_TIMEOUT) = q12 (TIMED_OUT)
- δ(q8, anything else)   = q13 (SINK)
- δ(q8, RESET)           = q0 (IDLE)

---

**Q: How is the state diagram kept consistent with the code?**
The backend exposes the full DFA definition via `GET /api/dfa/definition`. The frontend
fetches this endpoint to render both the state diagram and the transition table. There is
no separately maintained or hardcoded diagram — it is always derived from the canonical
transition table in `backend/app/dfa/transitions.py`.

---

**Q: How many tests are there and what do they cover?**
83 automated tests total:
- 35 DFA engine unit tests (totality, determinism, all 7 sequences, individual transitions)
- 23 API integration tests (all scenarios, balance deduction, idempotency, history, dashboard)
- 25 frontend tests (form validation, API calls, result display, utility functions)
