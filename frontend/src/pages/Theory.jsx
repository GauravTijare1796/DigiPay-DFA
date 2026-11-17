import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getDFADefinition } from '../services/api.js'

export default function Theory() {
  const [def, setDef] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    getDFADefinition()
      .then(d => { setDef(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">Theory of Computation — DFA Specification</h1>
        <p className="page-subtitle">Formal definition of the payment transaction automaton</p>
      </div>

      <div className="tabs">
        {['overview','states','alphabet','definition'].map(t => (
          <button key={t} className={`tab-btn ${activeTab===t?'active':''}`} onClick={()=>setActiveTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'states'   && <StatesTab def={def} loading={loading} />}
      {activeTab === 'alphabet' && <AlphabetTab def={def} loading={loading} />}
      {activeTab === 'definition' && <DefinitionTab def={def} loading={loading} />}
    </div>
  )
}

function OverviewTab() {
  return (
    <div style={{ maxWidth: 720 }}>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">What is a DFA?</span></div>
        <div className="panel-body">
          <p style={{ marginBottom: 12, lineHeight: 1.8, fontSize: '.88rem' }}>
            A <strong>Deterministic Finite Automaton (DFA)</strong> is a mathematical model of computation
            defined by the five-tuple <strong>M = (Q, Σ, δ, q₀, F)</strong> where:
          </p>
          <table className="def-table" style={{ marginBottom: 16 }}>
            <tbody>
              {[
                ['Q', 'A finite set of states'],
                ['Σ', 'A finite input alphabet (set of symbols)'],
                ['δ', 'A transition function: Q × Σ → Q'],
                ['q₀', 'The initial (start) state, q₀ ∈ Q'],
                ['F', 'The set of accepting (final) states, F ⊆ Q'],
              ].map(([sym, desc]) => (
                <tr key={sym}>
                  <td className="mono" style={{ paddingRight: 16, fontWeight: 700 }}>{sym}</td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: '.85rem', lineHeight: 1.8 }}>
            The DFA reads input symbols one at a time, makes exactly one deterministic transition
            per symbol, and either accepts or rejects the input string based on whether it ends in
            an accepting state. In DigiPay-DFA, each input symbol represents a semantic event
            in a payment transaction, and each state represents a stage in the transaction lifecycle.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">DigiPay-DFA: M = (Q, Σ, δ, q₀, F)</span></div>
        <div className="panel-body">
          <table className="def-table">
            <tbody>
              <tr>
                <td className="mono" style={{ paddingRight: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>Q</td>
                <td>14 states: q0 (IDLE) through q13 (SINK)</td>
              </tr>
              <tr>
                <td className="mono" style={{ paddingRight: 16, fontWeight: 700 }}>Σ</td>
                <td>14 symbols: START, RECIPIENT_VALID, RECIPIENT_INVALID, AMOUNT_VALID, AMOUNT_INVALID, AUTH_SUCCESS, AUTH_FAILURE, BALANCE_SUFFICIENT, BALANCE_INSUFFICIENT, PROCESS, PROCESS_SUCCESS, PROCESS_FAILURE, PROCESS_TIMEOUT, RESET</td>
              </tr>
              <tr>
                <td className="mono" style={{ paddingRight: 16, fontWeight: 700 }}>δ</td>
                <td>Complete transition table (14 × 14 = 196 entries, all defined — total DFA)</td>
              </tr>
              <tr>
                <td className="mono" style={{ paddingRight: 16, fontWeight: 700 }}>q₀</td>
                <td>q0 (IDLE) — initial state</td>
              </tr>
              <tr>
                <td className="mono" style={{ paddingRight: 16, fontWeight: 700 }}>F</td>
                <td>&#123;q9&#125; — only SUCCESS is an accepting state</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Total DFA and the Sink State</span></div>
        <div className="panel-body" style={{ fontSize: '.85rem', lineHeight: 1.8 }}>
          <p style={{ marginBottom: 10 }}>
            DigiPay-DFA is a <strong>total DFA</strong>: for every state q ∈ Q and every symbol a ∈ Σ,
            δ(q, a) is defined. This means the transition function is total (complete).
          </p>
          <p style={{ marginBottom: 10 }}>
            The state <strong>q13 (SINK)</strong> is the dead state. Any undefined or out-of-sequence event
            causes the automaton to enter q13, where it remains (absorbing state) for all further symbols
            except RESET, which returns it to q0.
          </p>
          <p>
            This design clearly distinguishes between a technically invalid event sequence (→ SINK)
            and a semantically valid but rejected transaction (→ REJECTED/FAILED/TIMED_OUT).
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Example Accepted Sequence</span></div>
        <div className="panel-body">
          <div style={{ fontSize: '.82rem', marginBottom: 8, fontWeight: 600 }}>
            A fully valid payment: accepted by F = &#123;q9&#125;
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', lineHeight: 2 }}>
            START → RECIPIENT_VALID → AMOUNT_VALID → AUTH_SUCCESS → BALANCE_SUFFICIENT → PROCESS → PROCESS_SUCCESS
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
            q0 → q1 → q2 → q4 → q6 → q7 → q8 → q9 ✓
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><span className="panel-title">Example Rejected Sequences</span></div>
        <div className="panel-body">
          {[
            { desc: 'Invalid recipient', seq: 'START → RECIPIENT_INVALID', path: 'q0 → q1 → q10 (REJECTED)' },
            { desc: 'Invalid amount',    seq: 'START → RECIPIENT_VALID → AMOUNT_INVALID', path: 'q0 → q1 → q2 → q10 (REJECTED)' },
            { desc: 'Auth failure',      seq: 'START → RECIPIENT_VALID → AMOUNT_VALID → AUTH_FAILURE', path: 'q0 → q1 → q2 → q4 → q11 (FAILED)' },
            { desc: 'Insufficient balance', seq: 'START → RECIPIENT_VALID → AMOUNT_VALID → AUTH_SUCCESS → BALANCE_INSUFFICIENT', path: 'q0 → q1 → q2 → q4 → q6 → q10 (REJECTED)' },
            { desc: 'Malformed sequence (→ SINK)', seq: 'AMOUNT_VALID → START', path: 'q0 → q13 (SINK)' },
          ].map(e => (
            <div key={e.desc} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: '.82rem', marginBottom: 3 }}>{e.desc}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.76rem', color: 'var(--color-text-muted)' }}>{e.seq}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.73rem', color: 'var(--color-red)', marginTop: 2 }}>{e.path}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <Link to="/simulator" className="btn btn-primary">Try the step simulator →</Link>
      </div>
    </div>
  )
}

function StatesTab({ def, loading }) {
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (!def) return <div className="notice notice-error">Could not load DFA definition.</div>

  return (
    <div className="table-wrap">
      <table className="def-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Label</th>
            <th>Initial?</th>
            <th>Accepting?</th>
            <th>Terminal?</th>
            <th>Sink?</th>
          </tr>
        </thead>
        <tbody>
          {def.states.map(s => (
            <tr key={s.id}>
              <td className="mono">{s.id}</td>
              <td style={{ fontWeight: 500 }}>{s.label}</td>
              <td>{s.is_initial  ? <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>q₀</span> : ''}</td>
              <td>{s.is_accepting? <span style={{ color: 'var(--color-green)', fontWeight: 700 }}>✓</span> : ''}</td>
              <td>{s.is_terminal ? <span style={{ color: 'var(--color-text-muted)' }}>✓</span> : ''}</td>
              <td>{s.is_sink     ? <span style={{ color: 'var(--color-text-muted)' }}>dead</span> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AlphabetTab({ def, loading }) {
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (!def) return <div className="notice notice-error">Could not load DFA definition.</div>

  return (
    <div className="table-wrap">
      <table className="def-table">
        <thead>
          <tr><th>Symbol</th><th>Description</th></tr>
        </thead>
        <tbody>
          {def.alphabet.map(a => (
            <tr key={a.id}>
              <td className="mono">{a.id}</td>
              <td>{a.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DefinitionTab({ def, loading }) {
  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (!def) return <div className="notice notice-error">Could not load DFA definition.</div>

  // Build a state × symbol matrix (too many rows to show all — show key states)
  const keyStates = ['q0','q1','q2','q4','q6','q7','q8','q9','q10','q11','q12','q13']
  const keySymbols= ['START','RECIPIENT_VALID','RECIPIENT_INVALID','AMOUNT_VALID','AMOUNT_INVALID','AUTH_SUCCESS','AUTH_FAILURE','BALANCE_SUFFICIENT','BALANCE_INSUFFICIENT','PROCESS','PROCESS_SUCCESS','PROCESS_FAILURE','PROCESS_TIMEOUT']

  // Build lookup
  const lookup = {}
  for (const t of def.transitions) {
    if (!lookup[t.source]) lookup[t.source] = {}
    lookup[t.source][t.symbol] = t.destination
  }

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: '.82rem', color: 'var(--color-text-muted)' }}>
        Condensed transition matrix (δ: state × symbol → next state). Full table exported from backend via <span className="mono">/api/dfa/definition</span>.
      </div>
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table className="def-table" style={{ fontSize: '.72rem', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--color-bg)', zIndex: 1 }}>δ(q, a)</th>
              {keySymbols.map(sym => <th key={sym} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80, whiteSpace: 'nowrap' }}>{sym}</th>)}
            </tr>
          </thead>
          <tbody>
            {keyStates.map(state => (
              <tr key={state}>
                <td className="mono" style={{ fontWeight: 700, position: 'sticky', left: 0, background: 'var(--color-bg)' }}>{state}</td>
                {keySymbols.map(sym => {
                  const dest = lookup[state]?.[sym] || '—'
                  let color = 'inherit'
                  if (dest === 'q9') color = 'var(--color-green)'
                  else if (['q10','q11','q12'].includes(dest)) color = 'var(--color-red)'
                  else if (dest === 'q13') color = 'var(--color-text-light)'
                  return <td key={sym} className="mono" style={{ textAlign: 'center', color }}>{dest}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
