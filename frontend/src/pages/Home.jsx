import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, GitBranch, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react'
import { getDashboardSummary, resetDemoBalances } from '../services/api.js'
import { formatINR, formatDate, statusLabel, statusClass } from '../utils/format.js'

export default function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const d = await getDashboardSummary()
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleReset() {
    if (!confirm('Reset all demo balances to defaults?')) return
    setResetting(true)
    setResetError(null)
    try {
      await resetDemoBalances()
      await load()
    } catch (e) {
      setResetError(e.message || 'Could not reset demo balances.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">DigiPay-DFA</h1>
        <p className="page-subtitle">
          Deterministic Finite Automata-Based Digital Payment Transaction Validator · Theory of Computation Project
        </p>
      </div>

      <div className="notice notice-warning" role="alert">
        <AlertNotice />
        This is an academic simulation. All accounts, balances, and transactions are fictional.
        No real money is involved and no actual UPI or banking infrastructure is used.
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <Link to="/payment" className="btn btn-primary">
          <CreditCard size={15} /> Simulate Payment
        </Link>
        <Link to="/simulator" className="btn btn-secondary">
          <GitBranch size={15} /> Explore DFA
        </Link>
        <Link to="/theory" className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }}>
          Theory &amp; Specification →
        </Link>
      </div>

      {loading && <div className="loading-center"><div className="spinner" /><span>Loading dashboard…</span></div>}
      {error && <div className="notice notice-error">Could not load dashboard: {error}</div>}

      {data && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Transactions</div>
              <div className="stat-value">{data.total_transactions}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Successful</div>
              <div className="stat-value green">{data.successful}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Failed</div>
              <div className="stat-value red">{data.failed}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Rejected</div>
              <div className="stat-value amber">{data.rejected}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Timed Out</div>
              <div className="stat-value amber">{data.timed_out}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Simulated</div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{formatINR(data.total_amount_paise)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Demo Balance</div>
              <div className="stat-value" style={{ fontSize: '1.1rem' }}>{formatINR(data.sender_balance_paise)}</div>
            </div>
          </div>

          {data.total_transactions === 0 ? (
            <div className="panel">
              <div className="panel-body">
                <div className="empty-state">
                  <div className="empty-state-icon"><CreditCard size={36} /></div>
                  <h3>No transactions yet</h3>
                  <p>Run your first payment simulation to see DFA state transitions in action.</p>
                  <Link to="/payment" className="btn btn-primary">Simulate First Payment</Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Recent Transactions</span>
                <Link to="/history" className="btn btn-ghost btn-sm">View all <ArrowRight size={13} /></Link>
              </div>
              <div className="table-wrap" style={{ boxShadow: 'none', border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Recipient</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_transactions.map(txn => (
                      <tr key={txn.id}>
                        <td>
                          <Link to={`/history/${txn.id}`} className="mono">{txn.reference}</Link>
                        </td>
                        <td>{txn.recipient_display_name}</td>
                        <td>{formatINR(txn.amount_paise)}</td>
                        <td><span className={`badge ${statusClass(txn.status)}`}>{statusLabel(txn.status)}</span></td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(txn.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-header"><span className="panel-title">Transaction Lifecycle</span></div>
            <div className="panel-body">
              <LifecycleOverview />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            {resetError && <div className="notice notice-error" role="alert">{resetError}</div>}
            <button
              onClick={handleReset}
              disabled={resetting}
              className="btn btn-ghost btn-sm"
            >
              {resetting ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Resetting…</> : 'Reset demo balances'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AlertNotice() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

const LIFECYCLE = [
  { state: 'q0', label: 'Idle', desc: 'Ready to accept a transaction' },
  { state: 'q1', label: 'Recipient Entered', desc: 'Recipient UPI ID received' },
  { state: 'q2', label: 'Recipient Validated', desc: 'Recipient exists in demo profiles' },
  { state: 'q4', label: 'Amount Validated', desc: 'Amount passes all validation rules' },
  { state: 'q6', label: 'Auth Validated', desc: 'Demo authentication successful' },
  { state: 'q7', label: 'Balance Check', desc: 'Sufficient demo balance confirmed' },
  { state: 'q8', label: 'Processing', desc: 'Payment processing in progress' },
  { state: 'q9', label: 'Success', desc: 'Transaction completed' },
]

function LifecycleOverview() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {LIFECYCLE.map((s, i) => (
        <div key={s.state} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 3, padding: '8px 12px',
            background: s.state === 'q9' ? 'var(--color-green-bg)' : 'var(--color-bg)',
            border: `1px solid ${s.state === 'q9' ? 'var(--color-green-dim)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-sm)', minWidth: 90, textAlign: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: 'var(--color-text-muted)' }}>{s.state}</span>
            <span style={{ fontSize: '.78rem', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: '.68rem', color: 'var(--color-text-muted)' }}>{s.desc}</span>
          </div>
          {i < LIFECYCLE.length - 1 && <span style={{ color: 'var(--color-text-light)', fontSize: '1rem' }}>→</span>}
        </div>
      ))}
    </div>
  )
}
