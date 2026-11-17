import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { getDemoAccounts, createTransaction } from '../services/api.js'
import { formatINR } from '../utils/format.js'

const SCENARIOS = [
  { value: 'success',              label: '1. Successful transaction' },
  { value: 'invalid_recipient',    label: '2. Invalid recipient' },
  { value: 'invalid_amount',       label: '3. Invalid amount (force)' },
  { value: 'auth_failure',         label: '4. Incorrect demo authentication' },
  { value: 'insufficient_balance', label: '5. Insufficient demo balance' },
  { value: 'process_failure',      label: '6. Processing failure' },
  { value: 'process_timeout',      label: '7. Processing timeout' },
]

const INITIAL = {
  recipient_upi_id: '',
  amount_paise: '',
  note: '',
  scenario: 'success',
}

function validate(fields) {
  const errors = {}
  if (!fields.recipient_upi_id) errors.recipient_upi_id = 'Select a recipient.'
  const amt = Number(fields.amount_paise)
  if (!fields.amount_paise || isNaN(amt)) errors.amount_paise = 'Enter a valid amount.'
  else if (amt <= 0) errors.amount_paise = 'Amount must be greater than ₹0.'
  else if (amt > 100000) errors.amount_paise = 'Amount cannot exceed ₹1,00,000.'
  else if (!Number.isFinite(amt)) errors.amount_paise = 'Enter a valid finite amount.'
  return errors
}

export default function Payment() {
  const [fields, setFields] = useState(INITIAL)
  const [errors, setErrors] = useState({})
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [apiError, setApiError] = useState(null)
  const [accountsError, setAccountsError] = useState(null)

  useEffect(() => {
    getDemoAccounts()
      .then(a => {
        const recipients = a.filter(x => !x.is_sender)
        setAccounts(recipients)
        if (recipients.length === 0) setAccountsError('No active demo recipients are available.')
      })
      .catch(e => setAccountsError(e.message || 'Could not load demo recipients.'))
  }, [])

  function change(e) {
    const { name, value } = e.target
    setFields(f => ({ ...f, [name]: value }))
    setErrors(er => ({ ...er, [name]: undefined }))
  }

  async function submit(e) {
    e.preventDefault()
    const errs = validate(fields)
    if (Object.keys(errs).length) { setErrors(errs); return }

    // Convert INR to paise
    const amount_paise = Math.round(Number(fields.amount_paise) * 100)

    setLoading(true)
    setApiError(null)
    setResult(null)

    try {
      const txn = await createTransaction({
        recipient_upi_id: fields.recipient_upi_id,
        amount_paise,
        note: fields.note || undefined,
        scenario: fields.scenario || undefined,
      })
      setResult(txn)
    } catch (err) {
      setApiError(err.message || 'Simulation failed.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setFields(INITIAL)
    setResult(null)
    setApiError(null)
    setErrors({})
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">Make a Payment</h1>
        <p className="page-subtitle">Simulate a payment transaction through the DFA engine</p>
      </div>

      <div className="notice notice-warning">
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
        All recipients are fictional demo profiles. No real UPI IDs, PINs, or banking
        credentials are used. No real money is transferred.
      </div>
      {accountsError && <div className="notice notice-error" role="alert">{accountsError}</div>}

      {result ? (
        <TransactionResult result={result} onReset={reset} />
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="form-section">

            <div className="form-row">
              <label className="form-label" htmlFor="recipient_upi_id">Recipient</label>
              <select
                id="recipient_upi_id"
                name="recipient_upi_id"
                value={fields.recipient_upi_id}
                onChange={change}
                className={errors.recipient_upi_id ? 'field-error' : ''}
              >
                <option value="">— Select a demo recipient —</option>
                {accounts.map(a => (
                  <option key={a.upi_id} value={a.upi_id}>
                    {a.display_name} ({a.upi_id})
                  </option>
                ))}
              </select>
              {errors.recipient_upi_id && <div className="form-error">{errors.recipient_upi_id}</div>}
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="amount_paise">Amount (₹ INR)</label>
              <input
                type="number"
                id="amount_paise"
                name="amount_paise"
                value={fields.amount_paise}
                onChange={change}
                placeholder="e.g. 500"
                min="0.01"
                max="100000"
                step="0.01"
                className={errors.amount_paise ? 'field-error' : ''}
              />
              <div className="form-hint">Enter amount in ₹. Max ₹1,00,000. Paise precision supported.</div>
              {errors.amount_paise && <div className="form-error">{errors.amount_paise}</div>}
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="note">Note (optional)</label>
              <input
                type="text"
                id="note"
                name="note"
                value={fields.note}
                onChange={change}
                maxLength={256}
                placeholder="e.g. Dinner split"
              />
            </div>

            <div className="form-row">
              <label className="form-label" htmlFor="scenario">Test Scenario</label>
              <select id="scenario" name="scenario" value={fields.scenario} onChange={change}>
                {SCENARIOS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <div className="form-hint">
                This selector is a testing aid to exercise different DFA paths.
                It is not a real UPI feature.
              </div>
            </div>

            {apiError && <div className="notice notice-error">{apiError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={loading || Boolean(accountsError) || accounts.length === 0}>
                {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : 'Simulate Payment'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={reset}>Clear</button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function TransactionResult({ result, onReset }) {
  const isSuccess = result.status === 'SUCCESS'
  const isTimeout = result.status === 'TIMED_OUT'
  const isRejected = result.status === 'REJECTED'

  const cls = isSuccess ? 'success' : isRejected ? 'rejected' : 'failure'

  return (
    <>
      <div className={`txn-result ${cls}`}>
        <div className="txn-result-icon">
          {isSuccess
            ? <CheckCircle size={28} color="var(--color-green)" />
            : isTimeout
            ? <Clock size={28} color="var(--color-amber)" />
            : <XCircle size={28} color="var(--color-red)" />}
        </div>
        <div className="txn-result-title">
          {isSuccess ? 'Payment Successful' : isRejected ? 'Transaction Rejected' : isTimeout ? 'Transaction Timed Out' : 'Transaction Failed'}
        </div>
        <div className="txn-result-ref">{result.reference}</div>
        <div style={{ marginTop: 10, fontSize: '.85rem' }}>
          <strong>{formatINR(result.amount_paise)}</strong> to {result.recipient_display_name}
        </div>
        {result.outcome_reason && (
          <div style={{ marginTop: 6, fontSize: '.82rem', opacity: .8 }}>{result.outcome_reason}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <Link to={`/history/${result.id}`} className="btn btn-secondary">View DFA Trace</Link>
        <button className="btn btn-primary" onClick={onReset}>New Simulation</button>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">DFA State Path</span></div>
        <div className="panel-body">
          <div className="state-path">
            {result.trace.map((step, i) => (
              <span key={step.step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i === 0 && (
                  <>
                    <span className="trace-state">{step.source_state}</span>
                    <span className="state-path-arrow">→</span>
                  </>
                )}
                <span className={`trace-state ${i === result.trace.length - 1 ? stateClass(step.destination_state) : ''}`}>
                  {step.destination_state}
                </span>
                {i < result.trace.length - 1 && <span className="state-path-arrow">→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function stateClass(id) {
  if (id === 'q9') return 'state-success'
  if (['q10', 'q11', 'q12'].includes(id)) return 'state-failure'
  if (id === 'q13') return 'state-sink'
  return ''
}
