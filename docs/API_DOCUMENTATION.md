# API Documentation — DigiPay-DFA

Base URL (local): `http://127.0.0.1:8000/api`

Interactive docs: `http://127.0.0.1:8000/api/docs` (Swagger UI)

---

## GET /health

Returns application status.

**Response 200**
```json
{ "status": "ok", "app": "DigiPay-DFA", "version": "1.0.0" }
```

---

## GET /dfa/definition

Returns the complete formal DFA five-tuple as JSON.
The frontend uses this to render the state diagram and transition table.

**Response 200**
```json
{
  "states": [
    { "id": "q0", "label": "Idle", "is_initial": true, "is_accepting": false, "is_terminal": false, "is_sink": false },
    ...
  ],
  "alphabet": [
    { "id": "START", "label": "Start transaction" },
    ...
  ],
  "initial_state": "q0",
  "accepting_states": ["q9"],
  "transitions": [
    { "source": "q0", "symbol": "START", "destination": "q1" },
    ...
  ]
}
```

---

## GET /dfa/transitions

Returns only the flat transition list.

---

## GET /dfa/alphabet

Returns only the input alphabet with labels.

---

## POST /dfa/simulate

Run the DFA on a user-supplied event sequence. Used by the interactive simulator.

**Request**
```json
{ "input_sequence": ["START", "RECIPIENT_VALID", "AMOUNT_VALID", "AUTH_SUCCESS", "BALANCE_SUFFICIENT", "PROCESS", "PROCESS_SUCCESS"] }
```

**Response 200**
```json
{
  "accepted": true,
  "terminal_state": "q9",
  "terminal_label": "Success",
  "outcome": "Transaction completed successfully.",
  "trace": [
    {
      "step": 1,
      "source_state": "q0", "source_label": "Idle",
      "symbol": "START", "symbol_label": "Start transaction",
      "destination_state": "q1", "destination_label": "Recipient Entered",
      "explanation": "In state 'Idle', event 'Start transaction' → move to 'Recipient Entered'."
    },
    ...
  ]
}
```

**Response 422** — Invalid symbol in sequence.

---

## POST /api/transactions

Initiate a simulated payment transaction.

**Request**
```json
{
  "recipient_upi_id": "alex@demo",
  "amount_paise": 50000,
  "note": "Lunch",
  "scenario": "success",
  "idempotency_key": "optional-unique-key"
}
```

- `amount_paise`: integer, > 0, ≤ 10,000,000 (₹1,00,000)
- `scenario`: one of `success`, `invalid_recipient`, `invalid_amount`, `auth_failure`, `insufficient_balance`, `process_failure`, `process_timeout`

**Response 201**
```json
{
  "id": 1,
  "reference": "TXN-00000001",
  "sender_upi_id": "demo.user@digipay",
  "recipient_upi_id": "alex@demo",
  "recipient_display_name": "Alex Sharma",
  "amount_paise": 50000,
  "amount_inr": 500.0,
  "note": "Lunch",
  "status": "SUCCESS",
  "terminal_state": "q9",
  "scenario": "success",
  "outcome_reason": "All validations passed; payment processed successfully.",
  "created_at": "2026-10-17T10:00:00Z",
  "trace": [ ... ]
}
```

**Response 422** — Validation error (amount, missing fields).

---

## GET /api/transactions

Paginated transaction history.

**Query params**
| Param      | Type   | Default | Description                         |
|------------|--------|---------|-------------------------------------|
| page       | int    | 1       | Page number (≥ 1)                   |
| page_size  | int    | 20      | Items per page (1–100)              |
| status     | string | —       | Filter: SUCCESS, REJECTED, FAILED, TIMED_OUT |
| search     | string | —       | Search reference or recipient UPI   |

**Response 200**
```json
{
  "total": 7,
  "page": 1,
  "page_size": 20,
  "items": [ { ... } ]
}
```

---

## GET /api/transactions/{id}

Single transaction with full DFA trace.

**Response 200** — Same schema as POST /api/transactions.
**Response 404** — Transaction not found.

---

## GET /api/dashboard/summary

Aggregated statistics calculated from database records.

**Response 200**
```json
{
  "total_transactions": 7,
  "successful": 1,
  "failed": 2,
  "rejected": 3,
  "timed_out": 1,
  "total_amount_paise": 50000,
  "total_amount_inr": 500.0,
  "recent_transactions": [ ... ],
  "sender_balance_paise": 950000,
  "sender_balance_inr": 9500.0
}
```

---

## GET /api/demo/accounts

Returns all active demo accounts.

**Response 200**
```json
[
  { "upi_id": "demo.user@digipay", "display_name": "Demo User", "balance_paise": 950000, "balance_inr": 9500.0, "is_active": true, "is_sender": true },
  { "upi_id": "alex@demo", "display_name": "Alex Sharma", "balance_paise": 550000, "balance_inr": 5500.0, "is_active": true, "is_sender": false },
  ...
]
```

---

## POST /api/demo/reset

Reset all demo account balances to defaults. Does not delete transaction history.

**Response 200**
```json
{ "message": "Demo balances reset to defaults." }
```
