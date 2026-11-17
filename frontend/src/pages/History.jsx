import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getTransactions } from '../services/api.js'
import { formatINR, formatDate, statusLabel, statusClass } from '../utils/format.js'
import { Search } from 'lucide-react'

const PAGE_SIZE = 15

export default function History() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const d = await getTransactions({ page, page_size: PAGE_SIZE, search, status })
      setData(d)
    } catch (e) {
      setLoadError(e.message || 'Could not load transactions.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  function handleSearch(e) { setSearch(e.target.value); setPage(1) }
  function handleStatus(e) { setStatus(e.target.value); setPage(1) }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">Transaction History</h1>
        <p className="page-subtitle">All simulated payment transactions with DFA outcomes</p>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Search reference or recipient…"
            value={search}
            onChange={handleSearch}
            style={{ paddingLeft: 28, maxWidth: 260 }}
            aria-label="Search transactions"
          />
        </div>
        <select value={status} onChange={handleStatus} aria-label="Filter by status" style={{ maxWidth: 160 }}>
          <option value="">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="REJECTED">Rejected</option>
          <option value="FAILED">Failed</option>
          <option value="TIMED_OUT">Timed Out</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      </div>

      {loading && <div className="loading-center"><div className="spinner" /><span>Loading…</span></div>}
      {!loading && loadError && <div className="notice notice-error">{loadError}</div>}

      {!loading && data && (
        <>
          {data.items.length === 0 ? (
            <div className="panel">
              <div className="panel-body">
                <div className="empty-state">
                  <div className="empty-state-icon"><Search size={36} /></div>
                  <h3>No transactions found</h3>
                  <p>{search || status ? 'Try different filter criteria.' : 'No simulations yet.'}</p>
                  {!search && !status && (
                    <Link to="/payment" className="btn btn-primary">Simulate First Payment</Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Recipient</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Terminal State</th>
                    <th>Scenario</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(txn => (
                    <tr key={txn.id}>
                      <td><span className="mono">{txn.reference}</span></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{txn.recipient_display_name}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--color-text-muted)' }}>{txn.recipient_upi_id}</div>
                      </td>
                      <td>{formatINR(txn.amount_paise)}</td>
                      <td><span className={`badge ${statusClass(txn.status)}`}>{statusLabel(txn.status)}</span></td>
                      <td><span className="trace-state mono">{txn.terminal_state || '—'}</span></td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '.78rem' }}>{txn.scenario || '—'}</td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '.78rem' }}>{formatDate(txn.created_at)}</td>
                      <td>
                        <Link to={`/history/${txn.id}`} className="btn btn-ghost btn-sm">Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pagination">
                <div className="pagination-info">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  ← Prev
                </button>
                <span style={{ fontSize: '.8rem' }}>Page {page} / {totalPages}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
