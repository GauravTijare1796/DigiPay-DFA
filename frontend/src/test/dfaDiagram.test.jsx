import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DFADiagram from '../components/DFADiagram.jsx'

describe('DFA diagram', () => {
  it('uses the destination from the canonical transition definition', () => {
    const definition = {
      states: [
        { id: 'q0', label: 'Idle', is_initial: true, is_accepting: false },
        { id: 'q1', label: 'Recipient Entered', is_initial: false, is_accepting: false },
        { id: 'q2', label: 'Recipient Validated', is_initial: false, is_accepting: false },
      ],
      transitions: [{ source: 'q0', symbol: 'START', destination: 'q2' }],
    }

    const { container } = render(
      <DFADiagram
        definition={definition}
        activeState="q2"
        activeTransition={{ source_state: 'q0', destination_state: 'q2' }}
      />
    )

    expect(container.querySelector('.dfa-edge.active')).not.toBeNull()
    expect(container.querySelector('.dfa-edge.active line').getAttribute('x2')).toBe('278')
  })
})