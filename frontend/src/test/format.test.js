import { describe, it, expect } from 'vitest'
import { formatINR, formatDate, statusLabel, statusClass, stateClass } from '../utils/format.js'

describe('formatINR', () => {
  it('formats zero correctly', () => {
    expect(formatINR(0)).toContain('0')
  })

  it('formats 10000 paise as ₹100', () => {
    const result = formatINR(10000)
    expect(result).toContain('100')
  })

  it('formats null/undefined without throwing', () => {
    expect(() => formatINR(null)).not.toThrow()
    expect(() => formatINR(undefined)).not.toThrow()
  })
})

describe('statusLabel', () => {
  it('returns Success for SUCCESS', () => {
    expect(statusLabel('SUCCESS')).toBe('Success')
  })
  it('returns Rejected for REJECTED', () => {
    expect(statusLabel('REJECTED')).toBe('Rejected')
  })
  it('returns Failed for FAILED', () => {
    expect(statusLabel('FAILED')).toBe('Failed')
  })
  it('returns Timed Out for TIMED_OUT', () => {
    expect(statusLabel('TIMED_OUT')).toBe('Timed Out')
  })
  it('returns the raw string for unknown values', () => {
    expect(statusLabel('UNKNOWN')).toBe('UNKNOWN')
  })
})

describe('statusClass', () => {
  it('returns correct class for SUCCESS', () => {
    expect(statusClass('SUCCESS')).toBe('status-success')
  })
  it('returns correct class for FAILED', () => {
    expect(statusClass('FAILED')).toBe('status-failed')
  })
})

describe('stateClass', () => {
  it('returns state-success for q9', () => {
    expect(stateClass('q9')).toBe('state-success')
  })
  it('returns state-failure for q10', () => {
    expect(stateClass('q10')).toBe('state-failure')
  })
  it('returns state-failure for q11', () => {
    expect(stateClass('q11')).toBe('state-failure')
  })
  it('returns state-failure for q12', () => {
    expect(stateClass('q12')).toBe('state-failure')
  })
  it('returns state-sink for q13', () => {
    expect(stateClass('q13')).toBe('state-sink')
  })
  it('returns state-normal for intermediate states', () => {
    expect(stateClass('q0')).toBe('state-normal')
    expect(stateClass('q8')).toBe('state-normal')
  })
})
