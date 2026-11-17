/**
 * API client for DigiPay-DFA backend.
 * All requests go through the Vite dev-server proxy → FastAPI on :8000.
 */

const BASE = '/api'

async function request(path, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }))
    throw Object.assign(new Error(err.detail || 'Request failed'), {
      status: resp.status,
      data: err,
    })
  }
  return resp.json()
}

// ── Health ───────────────────────────────────────────────────────────────────
export const getHealth = () => request('/health')

// ── Dashboard ────────────────────────────────────────────────────────────────
export const getDashboardSummary = () => request('/dashboard/summary')

// ── Demo accounts ────────────────────────────────────────────────────────────
export const getDemoAccounts = () => request('/demo/accounts')
export const resetDemoBalances = () => request('/demo/reset', { method: 'POST' })

// ── Transactions ─────────────────────────────────────────────────────────────
export const createTransaction = (payload) =>
  request('/transactions', { method: 'POST', body: JSON.stringify(payload) })

export const getTransactions = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString()
  return request(`/transactions${qs ? `?${qs}` : ''}`)
}

export const getTransaction = (id) => request(`/transactions/${id}`)

// ── DFA ──────────────────────────────────────────────────────────────────────
export const getDFADefinition = () => request('/dfa/definition')
export const getDFAAlphabet = () => request('/dfa/alphabet')
export const simulateDFA = (inputSequence) =>
  request('/dfa/simulate', { method: 'POST', body: JSON.stringify({ input_sequence: inputSequence }) })
