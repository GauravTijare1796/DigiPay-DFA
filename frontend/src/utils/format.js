/**
 * Formatting utilities.
 */

export function formatINR(paise) {
  const inr = (paise ?? 0) / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(inr)
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function statusLabel(status) {
  const map = {
    SUCCESS: 'Success',
    REJECTED: 'Rejected',
    FAILED: 'Failed',
    TIMED_OUT: 'Timed Out',
    PENDING: 'Pending',
  }
  return map[status] ?? status
}

export function statusClass(status) {
  const map = {
    SUCCESS: 'status-success',
    REJECTED: 'status-rejected',
    FAILED: 'status-failed',
    TIMED_OUT: 'status-timeout',
    PENDING: 'status-pending',
  }
  return map[status] ?? 'status-pending'
}

export function stateClass(stateId) {
  if (stateId === 'q9') return 'state-success'
  if (['q10', 'q11', 'q12'].includes(stateId)) return 'state-failure'
  if (stateId === 'q13') return 'state-sink'
  return 'state-normal'
}
