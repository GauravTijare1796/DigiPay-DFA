import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import { getTransaction } from '../services/api.js'
import { formatINR, formatDate, statusLabel, statusClass, stateClass } from '../utils/format.js'

export default function TransactionDetail() {
  const { id } = useParams()
  const [txn, setTxn] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getTransaction(id)
      .then(setTxn)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page-body"><div className="loading-center"><div className="spinner" /><span>Loading transaction…</span></div></div>
  if (error)   return <div className="page-body"><div className="notice notice-error">{error}</div><Link to="/history" className="btn btn-ghost btn-sm">← Back</Link></div>
  if (!txn)    return null

  const isSuccess  = txn.status === 'SUCCESS'
  const isRejected = txn.status === 'REJECTED'
  const isTimeout  = txn.status === 'TIMED_OUT'

  return (
    <div className="page-body">
      <div style={{ marginBottom: 20 }}>
        <Link to="/history" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> Back to History</Link>
      </div>

      <div className="page-header">
        <h1 className="page-title">{txn.reference}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <span className={`badge ${statusClass(txn.status)}`}>{statusLabel(txn.status)}</span>
          <span style={{ fontSize: '.8rem', color: 'var(--color-text-muted)' }}>{formatDate(txn.created_at)}</span>
        </div>
      </div>

      {/* Result summary */}
      <div className={`txn-result ${isSuccess ? 'success' : isRejected ? 'rejected' : 'failure'}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {isSuccess
          ? <CheckCircle size={28} color="var(--color-green)" />
          : isTimeout
          ? <Clock size={28} color="var(--color-amber)" />
          : <XCircle size={28} color="var(--color-red)" />
        }
        <div>
          <div className="txn-result-title">
            {isSuccess ? 'Payment Successful' : isRejected ? 'Transaction Rejected' : isTimeout ? 'Transaction Timed Out' : 'Transaction Failed'}
          </div>
          <div style={{ marginTop: 4, fontSize: '.85rem' }}>
            <strong>{formatINR(txn.amount_paise)}</strong> to {txn.recipient_display_name} ({txn.recipient_upi_id})
          </div>
          {txn.outcome_reason && (
            <div style={{ marginTop: 4, fontSize: '.82rem', opacity: .8 }}>{txn.outcome_reason}</div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header"><span className="panel-title">Transaction Details</span></div>
        <div className="panel-body">
          <table className="def-table" style={{ width: 'auto' }}>
            <tbody>
              <Row label="Reference"         value={<span className="mono">{txn.reference}</span>} />
              <Row label="Sender"            value={txn.sender_upi_id} />
              <Row label="Recipient"         value={`${txn.recipient_display_name} (${txn.recipient_upi_id})`} />
              <Row label="Amount"            value={`${formatINR(txn.amount_paise)} (${txn.amount_paise.toLocaleString()} paise)`} />
              <Row label="Status"            value={<span className={`badge ${statusClass(txn.status)}`}>{statusLabel(txn.status)}</span>} />
              <Row label="Terminal State"    value={<span className={`trace-state mono ${stateClass(txn.terminal_state)}`}>{txn.terminal_state}</span>} />
              <Row label="Scenario"          value={txn.scenario || '—'} />
              <Row label="Note"              value={txn.note || '—'} />
              <Row label="Outcome"           value={txn.outcome_reason || '—'} />
              <Row label="Timestamp (UTC)"   value={formatDate(txn.created_at)} />
            </tbody>
          </table>
        </div>
      </div>

      {/* State path */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header"><span className="panel-title">DFA State Path</span></div>
        <div className="panel-body">
          <div className="state-path">
            {txn.trace.map((step, i) => (
              <span key={step.step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i === 0 && (
                  <>
                    <span className={`trace-state ${stateClass(step.source_state)}`}>{step.source_state}</span>
                    <span className="state-path-arrow">→</span>
                  </>
                )}
                <span className={`trace-state ${i === txn.trace.length - 1 ? stateClass(step.destination_state) : ''}`}>
                  {step.destination_state}
                </span>
                {i < txn.trace.length - 1 && <span className="state-path-arrow">→</span>}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: '.75rem', color: 'var(--color-text-muted)' }}>
            <Link to="/theory">View full DFA definition →</Link>
          </div>
        </div>
      </div>

      {/* Full trace */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">DFA Transition Trace</span></div>
        <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="trace-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>Source State</th>
                <th>Input Symbol</th>
                <th>Destination State</th>
                <th>Explanation</th>
              </tr>
            </thead>
            <tbody>
              {txn.trace.map(step => (
                <tr key={step.step}>
                  <td className="mono">{step.step}</td>
                  <td>
                    <span className={`trace-state ${stateClass(step.source_state)}`}>{step.source_state}</span>
                    <span style={{ fontSize: '.72rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>{step.source_label}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '.75rem' }}>{step.symbol}</span>
                    <span style={{ fontSize: '.72rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>{step.symbol_label}</span>
                  </td>
                  <td>
                    <span className={`trace-state ${stateClass(step.destination_state)}`}>{step.destination_state}</span>
                    <span style={{ fontSize: '.72rem', color: 'var(--color-text-muted)', marginLeft: 4 }}>{step.destination_label}</span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '.78rem' }}>{step.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <tr>
      <td style={{ fontWeight: 600, paddingRight: 24, whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</td>
      <td style={{ fontSize: '.85rem' }}>{value}</td>
    </tr>
  )
}
