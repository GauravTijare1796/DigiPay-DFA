import { useState, useEffect } from 'react'
import { getDFADefinition, simulateDFA } from '../services/api.js'
import { stateClass } from '../utils/format.js'
import DFADiagram from '../components/DFADiagram.jsx'

const BUILT_IN_SEQUENCES = [
  {
    label: 'Valid — Successful Transaction',
    sequence: ['START','RECIPIENT_VALID','AMOUNT_VALID','AUTH_SUCCESS','BALANCE_SUFFICIENT','PROCESS','PROCESS_SUCCESS'],
  },
  {
    label: 'Invalid Recipient',
    sequence: ['START','RECIPIENT_INVALID'],
  },
  {
    label: 'Invalid Amount',
    sequence: ['START','RECIPIENT_VALID','AMOUNT_INVALID'],
  },
  {
    label: 'Authentication Failure',
    sequence: ['START','RECIPIENT_VALID','AMOUNT_VALID','AUTH_FAILURE'],
  },
  {
    label: 'Insufficient Balance',
    sequence: ['START','RECIPIENT_VALID','AMOUNT_VALID','AUTH_SUCCESS','BALANCE_INSUFFICIENT'],
  },
  {
    label: 'Processing Failure',
    sequence: ['START','RECIPIENT_VALID','AMOUNT_VALID','AUTH_SUCCESS','BALANCE_SUFFICIENT','PROCESS','PROCESS_FAILURE'],
  },
  {
    label: 'Processing Timeout',
    sequence: ['START','RECIPIENT_VALID','AMOUNT_VALID','AUTH_SUCCESS','BALANCE_SUFFICIENT','PROCESS','PROCESS_TIMEOUT'],
  },
  {
    label: 'Malformed Sequence (→ Sink)',
    sequence: ['AMOUNT_VALID','START'],
  },
]

export default function DFASimulator() {
  const [definition, setDefinition] = useState(null)
  const [trace, setTrace] = useState(null)
  const [step, setStep] = useState(-1)  // -1 = not started
  const [selectedBuiltIn, setSelectedBuiltIn] = useState(0)
  const [customSeq, setCustomSeq] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('simulator')

  useEffect(() => {
    getDFADefinition()
      .then(setDefinition)
      .catch(() => setError('Could not load DFA definition'))
  }, [])

  async function runSimulation() {
    setError(null)
    let seq
    if (useCustom) {
      seq = customSeq.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    } else {
      seq = BUILT_IN_SEQUENCES[selectedBuiltIn].sequence
    }

    setLoading(true)
    try {
      const result = await simulateDFA(seq)
      setTrace(result)
      setStep(-1)
    } catch (e) {
      setError(e.message || 'Simulation failed')
      setTrace(null)
    } finally {
      setLoading(false)
    }
  }

  function reset() { setTrace(null); setStep(-1); setError(null) }
  function next()  { setStep(s => Math.min(s + 1, (trace?.trace?.length ?? 0) - 1)) }
  function prev()  { setStep(s => Math.max(s - 1, -1)) }
  function runAll(){ setStep((trace?.trace?.length ?? 0) - 1) }

  const currentState = trace
    ? (step === -1 ? 'q0' : trace.trace[step]?.destination_state)
    : null

  const currentTransition = trace && step >= 0 ? trace.trace[step] : null

  return (
    <div className="page-body">
      <div className="page-header">
        <h1 className="page-title">DFA Simulator</h1>
        <p className="page-subtitle">Interactive step-by-step automaton execution</p>
      </div>

      <div className="tabs" role="tablist">
        {[
          { id: 'simulator', label: 'Step Simulator' },
          { id: 'diagram',   label: 'State Diagram' },
          { id: 'table',     label: 'Transition Table' },
        ].map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            role="tab"
            aria-selected={activeTab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'simulator' && (
        <SimulatorTab
          trace={trace}
          step={step}
          currentState={currentState}
          currentTransition={currentTransition}
          selectedBuiltIn={selectedBuiltIn}
          setSelectedBuiltIn={setSelectedBuiltIn}
          customSeq={customSeq}
          setCustomSeq={setCustomSeq}
          useCustom={useCustom}
          setUseCustom={setUseCustom}
          loading={loading}
          error={error}
          onRun={runSimulation}
          onReset={reset}
          onNext={next}
          onPrev={prev}
          onRunAll={runAll}
        />
      )}

      {activeTab === 'diagram' && (
        <div>
          {!definition
            ? <div className="loading-center"><div className="spinner" /><span>Loading diagram…</span></div>
            : <DFADiagram definition={definition} activeState={currentState} activeTransition={currentTransition} />
          }
        </div>
      )}

      {activeTab === 'table' && (
        <TransitionTableTab definition={definition} />
      )}
    </div>
  )
}

function SimulatorTab({
  trace, step, currentState, currentTransition,
  selectedBuiltIn, setSelectedBuiltIn,
  customSeq, setCustomSeq, useCustom, setUseCustom,
  loading, error, onRun, onReset, onNext, onPrev, onRunAll
}) {
  const totalSteps = trace?.trace?.length ?? 0
  const isAtEnd = step === totalSteps - 1

  return (
    <div>
      {/* Input selection */}
      {!trace && (
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Select Input Sequence</span></div>
          <div className="panel-body">
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.83rem', cursor: 'pointer', marginBottom: 10 }}>
                <input type="radio" checked={!useCustom} onChange={() => setUseCustom(false)} />
                Use a built-in example sequence
              </label>
              {!useCustom && (
                <select value={selectedBuiltIn} onChange={e => setSelectedBuiltIn(Number(e.target.value))} style={{ maxWidth: 400 }}>
                  {BUILT_IN_SEQUENCES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
              )}
              {!useCustom && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Sequence:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {BUILT_IN_SEQUENCES[selectedBuiltIn].sequence.map((sym, i) => (
                      <span key={i} className="trace-state mono" style={{ fontSize: '.72rem' }}>{sym}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.83rem', cursor: 'pointer', marginBottom: 10 }}>
                <input type="radio" checked={useCustom} onChange={() => setUseCustom(true)} />
                Enter a custom sequence
              </label>
              {useCustom && (
                <div>
                  <input
                    type="text"
                    value={customSeq}
                    onChange={e => setCustomSeq(e.target.value)}
                    placeholder="e.g. START,RECIPIENT_VALID,AMOUNT_VALID,AUTH_SUCCESS,…"
                    style={{ maxWidth: 480 }}
                  />
                  <div className="form-hint">Comma or space separated. Valid symbols: START, RECIPIENT_VALID, RECIPIENT_INVALID, AMOUNT_VALID, AMOUNT_INVALID, AUTH_SUCCESS, AUTH_FAILURE, BALANCE_SUFFICIENT, BALANCE_INSUFFICIENT, PROCESS, PROCESS_SUCCESS, PROCESS_FAILURE, PROCESS_TIMEOUT, RESET</div>
                </div>
              )}
            </div>

            {error && <div className="notice notice-error" style={{ marginTop: 12 }}>{error}</div>}

            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={onRun} disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Running…</> : 'Run Simulation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active simulation */}
      {trace && (
        <>
          {/* Current state display */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-header">
              <span className="panel-title">Current State</span>
              <span className="step-indicator">
                Step {step === -1 ? 0 : step + 1} / {totalSteps}
              </span>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column',
                    border: '2px solid',
                    borderColor: currentState === 'q9' ? 'var(--color-green)' :
                                 ['q10','q11','q12'].includes(currentState) ? 'var(--color-red)' :
                                 currentState === 'q13' ? '#9ca3af' : 'var(--color-accent)',
                    background: currentState === 'q9' ? 'var(--color-green-bg)' :
                                ['q10','q11','q12'].includes(currentState) ? 'var(--color-red-bg)' :
                                currentState === 'q13' ? '#f9fafb' : 'var(--color-accent-dim)',
                  }}>
                    <span className="mono" style={{ fontSize: '.85rem', fontWeight: 700 }}>{currentState}</span>
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {getStateLabel(currentState)}
                  </div>
                </div>

                {currentTransition && (
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: '.75rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>Last Transition</div>
                    <div style={{ fontSize: '.85rem' }}>
                      <span className={`trace-state ${stateClass(currentTransition.source_state)}`}>{currentTransition.source_state}</span>
                      <span style={{ margin: '0 6px', color: 'var(--color-text-muted)' }}>—[{currentTransition.symbol}]→</span>
                      <span className={`trace-state ${stateClass(currentTransition.destination_state)}`}>{currentTransition.destination_state}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '.8rem', color: 'var(--color-text-muted)' }}>
                      {currentTransition.explanation}
                    </div>
                  </div>
                )}
              </div>

              {isAtEnd && (
                <div className={`notice ${trace.accepted ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 16 }}>
                  {trace.accepted
                    ? `Accepted — reached accepting state ${trace.terminal_state}.`
                    : `Not accepted — terminal state ${trace.terminal_state}. ${trace.outcome}`
                  }
                </div>
              )}
            </div>

            <div className="simulator-controls">
              <button className="btn btn-secondary btn-sm" onClick={onPrev} disabled={step < 0}>← Prev</button>
              <button className="btn btn-primary btn-sm" onClick={onNext} disabled={isAtEnd}>Next →</button>
              <button className="btn btn-ghost btn-sm" onClick={onRunAll} disabled={isAtEnd}>Run All</button>
              <button className="btn btn-ghost btn-sm" onClick={onReset}>Reset</button>
            </div>
          </div>

          {/* Trace table */}
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Transition Trace</span></div>
            <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
              <table className="trace-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>From</th>
                    <th>Symbol</th>
                    <th>To</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {trace.trace.map((t, i) => (
                    <tr key={t.step} style={{ opacity: i > step ? .35 : 1 }}>
                      <td className="mono">{t.step}</td>
                      <td><span className={`trace-state ${stateClass(t.source_state)}`}>{t.source_state}</span></td>
                      <td><span className="mono" style={{ fontSize: '.75rem' }}>{t.symbol}</span></td>
                      <td>
                        <span className={`trace-state ${i <= step ? stateClass(t.destination_state) : ''}`}>
                          {t.destination_state}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)', fontSize: '.78rem' }}>{t.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const STATE_LABELS = {
  q0: 'Idle', q1: 'Recipient Entered', q2: 'Recipient Validated',
  q3: 'Amount Entered', q4: 'Amount Validated', q5: 'Auth Pending',
  q6: 'Auth Validated', q7: 'Balance Check', q8: 'Processing',
  q9: 'Success', q10: 'Rejected', q11: 'Failed', q12: 'Timed Out', q13: 'Sink',
}

function getStateLabel(id) { return STATE_LABELS[id] || id }

function TransitionTableTab({ definition }) {
  const [filterState, setFilterState] = useState('')
  const [filterSym, setFilterSym] = useState('')

  if (!definition) return <div className="loading-center"><div className="spinner" /></div>

  const { states, alphabet, transitions } = definition

  const filtered = transitions.filter(t =>
    (!filterState || t.source === filterState) &&
    (!filterSym   || t.symbol === filterSym)
  )

  return (
    <div>
      <div className="filter-bar">
        <select value={filterState} onChange={e => setFilterState(e.target.value)} aria-label="Filter by state">
          <option value="">All source states</option>
          {states.map(s => <option key={s.id} value={s.id}>{s.id} — {s.label}</option>)}
        </select>
        <select value={filterSym} onChange={e => setFilterSym(e.target.value)} aria-label="Filter by symbol">
          <option value="">All symbols</option>
          {alphabet.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { setFilterState(''); setFilterSym('') }}>Clear</button>
      </div>

      <div className="table-wrap">
        <table className="def-table">
          <thead>
            <tr>
              <th>Source State</th>
              <th>Input Symbol</th>
              <th>Destination State</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={i}>
                <td>
                  <span className={`trace-state ${stateClass(t.source)}`}>{t.source}</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--color-text-muted)', marginLeft: 6 }}>
                    {states.find(s => s.id === t.source)?.label}
                  </span>
                </td>
                <td><span className="mono" style={{ fontSize: '.78rem' }}>{t.symbol}</span></td>
                <td>
                  <span className={`trace-state ${stateClass(t.destination)}`}>{t.destination}</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--color-text-muted)', marginLeft: 6 }}>
                    {states.find(s => s.id === t.destination)?.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 14px', fontSize: '.75rem', color: 'var(--color-text-muted)' }}>
        Showing {filtered.length} of {transitions.length} transitions
      </div>
    </div>
  )
}
