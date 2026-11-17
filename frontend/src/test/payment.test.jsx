/**
 * Frontend tests for the Payment form.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Payment from '../pages/Payment.jsx'
import * as api from '../services/api.js'

// Mock the API module
vi.mock('../services/api.js', () => ({
  getDemoAccounts: vi.fn(),
  createTransaction: vi.fn(),
}))

const MOCK_ACCOUNTS = [
  { upi_id: 'alex@demo', display_name: 'Alex Sharma', balance_paise: 500000, is_sender: false, is_active: true, balance_inr: 5000 },
  { upi_id: 'priya@demo', display_name: 'Priya Patil', balance_paise: 750000, is_sender: false, is_active: true, balance_inr: 7500 },
]

function renderPayment() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Payment />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getDemoAccounts.mockResolvedValue(MOCK_ACCOUNTS)
})

describe('Payment form', () => {
  it('renders the form heading', async () => {
    renderPayment()
    expect(screen.getByText('Make a Payment')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Alex Sharma/)).toBeTruthy())
  })

  it('shows the simulation disclaimer notice', async () => {
    renderPayment()
    await waitFor(() => {
      expect(screen.getByText(/fictional demo profiles/i)).toBeTruthy()
    })
  })

  it('populates recipient dropdown from API', async () => {
    renderPayment()
    await waitFor(() => {
      expect(screen.getByText(/Alex Sharma/)).toBeTruthy()
    })
  })

  it('shows an error and disables submission when recipient loading fails', async () => {
    api.getDemoAccounts.mockRejectedValue(new Error('API unavailable'))

    renderPayment()

    expect(await screen.findByRole('alert')).toHaveTextContent('API unavailable')
    expect(screen.getByRole('button', { name: /simulate payment/i })).toBeDisabled()
  })

  it('shows validation error when recipient is not selected', async () => {
    renderPayment()
    await waitFor(() => screen.getByText(/Alex Sharma/))

    fireEvent.click(screen.getByRole('button', { name: /simulate payment/i }))
    await waitFor(() => {
      expect(screen.getByText(/select a recipient/i)).toBeTruthy()
    })
  })

  it('shows validation error for zero amount', async () => {
    renderPayment()
    await waitFor(() => screen.getByText(/Alex Sharma/))

    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'alex@demo' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /simulate payment/i }))

    await waitFor(() => {
      expect(screen.getByText(/greater than/i)).toBeTruthy()
    })
  })

  it('shows validation error when amount exceeds limit', async () => {
    renderPayment()
    await waitFor(() => screen.getByText(/Alex Sharma/))

    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'alex@demo' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '200000' } })
    fireEvent.click(screen.getByRole('button', { name: /simulate payment/i }))

    await waitFor(() => {
      const errors = screen.getAllByText(/1,00,000/)
      expect(errors.some(el => el.className === 'form-error')).toBe(true)
    })
  })

  it('calls createTransaction on valid submit', async () => {
    api.createTransaction.mockResolvedValue({
      id: 1,
      reference: 'TXN-00000001',
      status: 'SUCCESS',
      terminal_state: 'q9',
      amount_paise: 50000,
      amount_inr: 500,
      recipient_display_name: 'Alex Sharma',
      recipient_upi_id: 'alex@demo',
      outcome_reason: 'Success',
      trace: [],
    })

    renderPayment()
    await waitFor(() => screen.getByText(/Alex Sharma/))

    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'alex@demo' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /simulate payment/i }))

    await waitFor(() => {
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_upi_id: 'alex@demo',
          amount_paise: 50000,
        })
      )
    })
  })

  it('shows success result after successful transaction', async () => {
    api.createTransaction.mockResolvedValue({
      id: 1,
      reference: 'TXN-00000001',
      status: 'SUCCESS',
      terminal_state: 'q9',
      amount_paise: 50000,
      amount_inr: 500,
      recipient_display_name: 'Alex Sharma',
      recipient_upi_id: 'alex@demo',
      outcome_reason: 'All validations passed.',
      trace: [],
    })

    renderPayment()
    await waitFor(() => screen.getByText(/Alex Sharma/))

    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'alex@demo' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /simulate payment/i }))

    await waitFor(() => {
      expect(screen.getByText(/Payment Successful/i)).toBeTruthy()
    })
  })

  it('shows failure result after failed transaction', async () => {
    api.createTransaction.mockResolvedValue({
      id: 2,
      reference: 'TXN-00000002',
      status: 'FAILED',
      terminal_state: 'q11',
      amount_paise: 10000,
      amount_inr: 100,
      recipient_display_name: 'Alex Sharma',
      recipient_upi_id: 'alex@demo',
      outcome_reason: 'Demo authentication failed.',
      trace: [],
    })

    renderPayment()
    await waitFor(() => screen.getByText(/Alex Sharma/))

    fireEvent.change(screen.getByLabelText(/recipient/i), { target: { value: 'alex@demo' } })
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText(/test scenario/i), { target: { value: 'auth_failure' } })
    fireEvent.click(screen.getByRole('button', { name: /simulate payment/i }))

    await waitFor(() => {
      expect(screen.getByText(/Transaction Failed/i)).toBeTruthy()
    })
  })
})
