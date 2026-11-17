import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Home from '../pages/Home.jsx'
import * as api from '../services/api.js'

vi.mock('../services/api.js', () => ({
  getDashboardSummary: vi.fn(),
  resetDemoBalances: vi.fn(),
}))

describe('Dashboard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.getDashboardSummary.mockResolvedValue({
      total_transactions: 0,
      successful: 0,
      failed: 0,
      rejected: 0,
      timed_out: 0,
      total_amount_paise: 0,
      sender_balance_paise: 1_000_000,
      recent_transactions: [],
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('shows reset errors without hiding the dashboard', async () => {
    api.resetDemoBalances.mockRejectedValue(new Error('Reset unavailable'))
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Home /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: /reset demo balances/i }))

    expect(await screen.findByText('Reset unavailable')).toBeTruthy()
    expect(screen.getByText('Total Transactions')).toBeTruthy()
  })
})