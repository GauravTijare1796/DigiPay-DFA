"""
End-to-end verification script.
Runs against the live server and checks every required scenario.
Prints PASS/FAIL for each check.
"""
import sys
import io
# Force UTF-8 output on Windows so arrow characters print correctly
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import urllib.request
import urllib.error
import json
import time

BASE = 'http://127.0.0.1:8000/api'
PASS = 0
FAIL = 0

def get(path):
    r = urllib.request.urlopen(BASE + path, timeout=5)
    return json.loads(r.read())

def post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, body, {'Content-Type': 'application/json'})
    r = urllib.request.urlopen(req, timeout=5)
    return json.loads(r.read())

def post_expect_error(path, data, expected_status):
    body = json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, body, {'Content-Type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=5)
        return None, 200
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

def check(label, condition, detail=''):
    global PASS, FAIL
    if condition:
        print(f'  PASS  {label}')
        PASS += 1
    else:
        print(f'  FAIL  {label}' + (f' — {detail}' if detail else ''))
        FAIL += 1

print('\n=== 1. HEALTH ===')
h = get('/health')
check('Health status ok', h['status'] == 'ok')

print('\n=== 2. DFA DEFINITION ===')
defn = get('/dfa/definition')
check('14 states defined', len(defn['states']) == 14, str(len(defn['states'])))
check('14 alphabet symbols', len(defn['alphabet']) == 14, str(len(defn['alphabet'])))
check('196 transitions (total DFA)', len(defn['transitions']) == 196, str(len(defn['transitions'])))
check('Initial state is q0', defn['initial_state'] == 'q0')
check('Accepting states = {q9}', defn['accepting_states'] == ['q9'])

print('\n=== 3. DFA SIMULATE ===')
success_seq = ['START','RECIPIENT_VALID','AMOUNT_VALID','AUTH_SUCCESS','BALANCE_SUFFICIENT','PROCESS','PROCESS_SUCCESS']
sim = post('/dfa/simulate', {'input_sequence': success_seq})
check('Successful sequence accepted', sim['accepted'] is True)
check('Terminal state q9', sim['terminal_state'] == 'q9')
check('7 trace steps', len(sim['trace']) == 7, str(len(sim['trace'])))

rejected_sim = post('/dfa/simulate', {'input_sequence': ['START', 'RECIPIENT_INVALID']})
check('RECIPIENT_INVALID → not accepted', rejected_sim['accepted'] is False)
check('RECIPIENT_INVALID → q10', rejected_sim['terminal_state'] == 'q10')

sink_sim = post('/dfa/simulate', {'input_sequence': ['AMOUNT_VALID', 'START']})
check('Malformed sequence → q13 sink', sink_sim['terminal_state'] == 'q13')

err_body, err_code = post_expect_error('/dfa/simulate', {'input_sequence': ['BOGUS_SYMBOL']}, 422)
check('Invalid symbol → 422', err_code == 422, str(err_code))

print('\n=== 4. DEMO ACCOUNTS ===')
accounts = get('/demo/accounts')
upi_ids = [a['upi_id'] for a in accounts]
check('4 demo accounts', len(accounts) == 4, str(len(accounts)))
check('Sender account present', 'demo.user@digipay' in upi_ids)
check('alex@demo present', 'alex@demo' in upi_ids)
check('priya@demo present', 'priya@demo' in upi_ids)
check('merchant@demo present', 'merchant@demo' in upi_ids)

sender = next(a for a in accounts if a['upi_id'] == 'demo.user@digipay')
initial_balance = sender['balance_paise']
print(f'  INFO  Sender initial balance: ₹{initial_balance/100:.2f}')

print('\n=== 5. TRANSACTION SCENARIOS ===')

# Successful
t1 = post('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 50000, 'scenario': 'success'})
check('Scenario success → SUCCESS', t1['status'] == 'SUCCESS', t1['status'])
check('Scenario success → terminal q9', t1['terminal_state'] == 'q9')
check('Trace has 7 steps', len(t1['trace']) == 7, str(len(t1['trace'])))
check('State path ends at q9', t1['trace'][-1]['destination_state'] == 'q9')
check('Outcome reason present', bool(t1['outcome_reason']))

# Invalid recipient
t2 = post('/transactions', {'recipient_upi_id': 'nobody@demo', 'amount_paise': 10000, 'scenario': 'invalid_recipient'})
check('invalid_recipient → REJECTED', t2['status'] == 'REJECTED', t2['status'])
check('invalid_recipient → q10', t2['terminal_state'] == 'q10')
check('Trace ends at q10', t2['trace'][-1]['destination_state'] == 'q10')

# Invalid amount (forced via scenario)
t3 = post('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 10000, 'scenario': 'invalid_amount'})
check('invalid_amount → REJECTED', t3['status'] == 'REJECTED', t3['status'])
check('invalid_amount → q10', t3['terminal_state'] == 'q10')

# Auth failure
t4 = post('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 10000, 'scenario': 'auth_failure'})
check('auth_failure → FAILED', t4['status'] == 'FAILED', t4['status'])
check('auth_failure → q11', t4['terminal_state'] == 'q11')

# Insufficient balance
t5 = post('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 10000, 'scenario': 'insufficient_balance'})
check('insufficient_balance → REJECTED', t5['status'] == 'REJECTED', t5['status'])
check('insufficient_balance → q10', t5['terminal_state'] == 'q10')

# Processing failure
t6 = post('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 10000, 'scenario': 'process_failure'})
check('process_failure → FAILED', t6['status'] == 'FAILED', t6['status'])
check('process_failure → q11', t6['terminal_state'] == 'q11')

# Timeout
t7 = post('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 10000, 'scenario': 'process_timeout'})
check('process_timeout → TIMED_OUT', t7['status'] == 'TIMED_OUT', t7['status'])
check('process_timeout → q12', t7['terminal_state'] == 'q12')

print('\n=== 6. BALANCE INTEGRITY ===')
accounts2 = get('/demo/accounts')
sender2 = next(a for a in accounts2 if a['upi_id'] == 'demo.user@digipay')
alex2 = next(a for a in accounts2 if a['upi_id'] == 'alex@demo')

expected_sender = initial_balance - 50000  # only 1 success of ₹500
check('Balance debited only for SUCCESS', sender2['balance_paise'] == expected_sender,
      f"expected {expected_sender}, got {sender2['balance_paise']}")
check('Failed txns did NOT debit balance', sender2['balance_paise'] == initial_balance - 50000)
print(f'  INFO  Sender balance after 7 txns: ₹{sender2["balance_paise"]/100:.2f} (expected ₹{expected_sender/100:.2f})')

print('\n=== 7. IDEMPOTENCY ===')
idem_key = f'e2e-test-idem-{int(time.time())}'
# Get balance before idempotency test
accts_pre_idem = get('/demo/accounts')
sender_pre_idem = next(a for a in accts_pre_idem if a['upi_id'] == 'demo.user@digipay')
balance_before_idem = sender_pre_idem['balance_paise']

ia = post('/transactions', {'recipient_upi_id': 'priya@demo', 'amount_paise': 20000, 'scenario': 'success', 'idempotency_key': idem_key})
ib = post('/transactions', {'recipient_upi_id': 'priya@demo', 'amount_paise': 20000, 'scenario': 'success', 'idempotency_key': idem_key})
check('Idempotent requests return same reference', ia['reference'] == ib['reference'], f'{ia["reference"]} vs {ib["reference"]}')

accounts3 = get('/demo/accounts')
sender3 = next(a for a in accounts3 if a['upi_id'] == 'demo.user@digipay')
# Two calls with same key should debit exactly once (20000 paise)
check('Idempotency: balance debited only once', sender3['balance_paise'] == balance_before_idem - 20000,
      f"expected {balance_before_idem - 20000}, got {sender3['balance_paise']}")

print('\n=== 8. TRANSACTION HISTORY ===')
hist = get('/transactions?page=1&page_size=10')
check('History returns correct total', hist['total'] >= 8, str(hist['total']))
check('History items not empty', len(hist['items']) > 0)
check('Each item has reference', all('reference' in x for x in hist['items']))
check('Each item has status', all('status' in x for x in hist['items']))
check('Each item has terminal_state', all('terminal_state' in x for x in hist['items']))

# Filter by status
hist_succ = get('/transactions?status=SUCCESS')
check('Filter SUCCESS works', all(x['status'] == 'SUCCESS' for x in hist_succ['items']))

hist_fail = get('/transactions?status=FAILED')
check('Filter FAILED works', all(x['status'] == 'FAILED' for x in hist_fail['items']))

# Search
hist_search = get('/transactions?search=TXN-00000001')
check('Search by reference works', hist_search['total'] >= 1)

print('\n=== 9. TRANSACTION DETAIL ===')
detail = get(f'/transactions/{t1["id"]}')
check('Detail returns correct id', detail['id'] == t1['id'])
check('Detail has full trace', len(detail['trace']) == 7)
check('Detail trace step 1 source is q0', detail['trace'][0]['source_state'] == 'q0')
check('Detail trace step 1 symbol is START', detail['trace'][0]['symbol'] == 'START')
check('Detail trace last dest is q9', detail['trace'][-1]['destination_state'] == 'q9')
check('Detail has recipient_display_name', bool(detail['recipient_display_name']))
check('Detail has outcome_reason', bool(detail['outcome_reason']))

# 404
_, code404 = post_expect_error('/transactions', {'id': 999999}, 422)  # wrong endpoint
r404 = None
try:
    get('/transactions/999999')
except urllib.error.HTTPError as e:
    r404 = e.code
check('Non-existent transaction → 404', r404 == 404, str(r404))

print('\n=== 10. DASHBOARD SUMMARY ===')
dash = get('/dashboard/summary')
check('Dashboard total_transactions >= 9', dash['total_transactions'] >= 9, str(dash['total_transactions']))
check('Dashboard successful >= 2', dash['successful'] >= 2, str(dash['successful']))
check('Dashboard failed >= 2', dash['failed'] >= 2, str(dash['failed']))
check('Dashboard rejected >= 3', dash['rejected'] >= 3, str(dash['rejected']))
check('Dashboard timed_out >= 1', dash['timed_out'] >= 1, str(dash['timed_out']))
check('Dashboard total_amount_paise > 0', dash['total_amount_paise'] > 0, str(dash['total_amount_paise']))
check('Dashboard recent_transactions <= 5', len(dash['recent_transactions']) <= 5)
check('Dashboard sender_balance_paise is correct', dash['sender_balance_paise'] == sender3['balance_paise'],
      f"dashboard={dash['sender_balance_paise']}, accounts={sender3['balance_paise']}")

print('\n=== 11. INPUT VALIDATION (422 errors) ===')
_, c1 = post_expect_error('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 0}, 422)
check('amount_paise=0 → 422', c1 == 422, str(c1))
_, c2 = post_expect_error('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': -100}, 422)
check('amount_paise=-100 → 422', c2 == 422, str(c2))
_, c3 = post_expect_error('/transactions', {'recipient_upi_id': 'alex@demo', 'amount_paise': 999_999_999}, 422)
check('excessive amount → 422', c3 == 422, str(c3))
_, c4 = post_expect_error('/transactions', {'recipient_upi_id': '', 'amount_paise': 1000}, 422)
check('empty recipient → 422', c4 == 422, str(c4))

print('\n=== 12. DEMO BALANCE RESET ===')
reset_resp = post('/demo/reset', {})
check('Reset returns message', 'message' in reset_resp)
accounts_reset = get('/demo/accounts')
sender_reset = next(a for a in accounts_reset if a['upi_id'] == 'demo.user@digipay')
check('Balance reset to default ₹10,000', sender_reset['balance_paise'] == 1_000_000,
      f"got {sender_reset['balance_paise']}")

print(f'\n{"="*50}')
print(f'  RESULT: {PASS} passed, {FAIL} failed out of {PASS+FAIL} checks')
print('='*50)
sys.exit(0 if FAIL == 0 else 1)
