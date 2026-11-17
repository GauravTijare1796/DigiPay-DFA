/**
 * DFADiagram — SVG state diagram rendered from the canonical DFA definition.
 * Uses a manually specified layout for readability, since the automaton has
 * a known linear flow with branches.
 */

import { useMemo } from 'react'

// Fixed node positions (x, y) for the 14 states
const NODE_POS = {
  q0:  { x: 60,  y: 200 },
  q1:  { x: 180, y: 200 },
  q2:  { x: 310, y: 200 },
  q3:  { x: 310, y: 320 }, // unused in normal flow — offset below
  q4:  { x: 440, y: 200 },
  q5:  { x: 440, y: 320 }, // unused in normal flow
  q6:  { x: 570, y: 200 },
  q7:  { x: 700, y: 200 },
  q8:  { x: 830, y: 200 },
  q9:  { x: 960, y: 200 }, // SUCCESS (accepting)
  q10: { x: 440, y: 360 }, // REJECTED
  q11: { x: 570, y: 360 }, // FAILED
  q12: { x: 830, y: 360 }, // TIMED_OUT
  q13: { x: 700, y: 360 }, // SINK
}

const R = 32 // node radius

// Only render the most meaningful transitions to keep the diagram readable
// (showing all ~182 transitions would be unreadable)
const VISIBLE_TRANSITIONS = [
  // Happy path
  { source: 'q0', symbol: 'START',              bend: 0 },
  { source: 'q1', symbol: 'RECIPIENT_VALID',     bend: 0 },
  { source: 'q2', symbol: 'AMOUNT_VALID',        bend: 0 },
  { source: 'q4', symbol: 'AUTH_SUCCESS',        bend: 0 },
  { source: 'q6', symbol: 'BALANCE_SUFFICIENT',  bend: 0 },
  { source: 'q7', symbol: 'PROCESS',             bend: 0 },
  { source: 'q8', symbol: 'PROCESS_SUCCESS',     bend: 0 },
  // Rejections
  { source: 'q1', symbol: 'RECIPIENT_INVALID',   bend: -30 },
  { source: 'q2', symbol: 'AMOUNT_INVALID',      bend: -20 },
  { source: 'q6', symbol: 'BALANCE_INSUFFICIENT',bend: -15 },
  // Failures
  { source: 'q4', symbol: 'AUTH_FAILURE',        bend: -20 },
  { source: 'q8', symbol: 'PROCESS_FAILURE',     bend: 30 },
  // Timeout
  { source: 'q8', symbol: 'PROCESS_TIMEOUT',     bend: -15 },
  // Sink sample
  { source: 'q0', symbol: 'AMOUNT_VALID',        bend: -40 },
]

export default function DFADiagram({ definition, activeState, activeTransition }) {
  const { states } = definition
  const visibleTransitions = VISIBLE_TRANSITIONS.flatMap(({ source, symbol, bend }) => {
    const transition = definition.transitions.find(
      item => item.source === source && item.symbol === symbol
    )
    if (!transition) return []

    return [{
      from: transition.source,
      to: transition.destination,
      label: transition.symbol,
      bend,
    }]
  })

  const stateMap = useMemo(() => {
    const m = {}
    for (const s of states) m[s.id] = s
    return m
  }, [states])

  const W = 1060, H = 440

  return (
    <div>
      <div className="dfa-diagram-wrap" style={{ marginBottom: 16 }}>
        <div className="dfa-svg-container">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label="DFA state diagram showing all states and key transitions"
            style={{ minWidth: 800 }}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
              </marker>
              <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-accent)" />
              </marker>
            </defs>

            {/* Transitions */}
            {visibleTransitions.map((t, i) => {
              const from = NODE_POS[t.from]
              const to   = NODE_POS[t.to]
              if (!from || !to) return null
              const isActive = activeTransition &&
                activeTransition.source_state === t.from &&
                activeTransition.destination_state === t.to

              return (
                <Edge
                  key={i}
                  from={from} to={to}
                  label={t.label}
                  bend={t.bend}
                  isActive={isActive}
                />
              )
            })}

            {/* State nodes */}
            {states.map(s => {
              const pos = NODE_POS[s.id]
              if (!pos) return null
              const isActive   = s.id === activeState
              const isAccepting= s.is_accepting
              const isFail     = ['q10','q11','q12'].includes(s.id)
              const isSink     = s.id === 'q13'
              const isInitial  = s.is_initial

              let stroke = '#d1d5db'
              let fill   = '#fff'
              if (isAccepting) { stroke = 'var(--color-green)'; fill = 'var(--color-green-bg)' }
              else if (isFail) { stroke = 'var(--color-red)'; fill = 'var(--color-red-bg)' }
              else if (isSink) { stroke = '#9ca3af'; fill = '#f9fafb' }
              else if (isActive){ stroke = 'var(--color-accent)'; fill = 'var(--color-accent-dim)' }

              return (
                <g key={s.id} className={`dfa-node ${isAccepting ? 'accepting' : ''}`}>
                  {/* Initial state arrow */}
                  {isInitial && (
                    <line
                      x1={pos.x - R - 18} y1={pos.y}
                      x2={pos.x - R - 2}  y2={pos.y}
                      stroke="#9ca3af" strokeWidth="1.5"
                      markerEnd="url(#arrow)"
                    />
                  )}
                  {/* Outer ring for accepting state */}
                  {isAccepting && (
                    <circle cx={pos.x} cy={pos.y} r={R + 5}
                      fill="none" stroke="var(--color-green)" strokeWidth="1.5" strokeDasharray="4 2" />
                  )}
                  <circle
                    cx={pos.x} cy={pos.y} r={R}
                    fill={fill} stroke={stroke} strokeWidth={isActive ? 2 : 1.5}
                  />
                  <text x={pos.x} y={pos.y - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-navy)">
                    {s.id}
                  </text>
                  <text x={pos.x} y={pos.y + 10} textAnchor="middle" fontSize="8" fill="var(--color-text-muted)">
                    {s.label.length > 14 ? s.label.slice(0,13) + '…' : s.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '.75rem', color: 'var(--color-text-muted)', padding: '0 4px 16px' }}>
        <LegendItem color="var(--color-green)" label="Accepting state (SUCCESS)" />
        <LegendItem color="var(--color-red)"   label="Failure/rejection state" />
        <LegendItem color="#9ca3af"            label="Sink state (invalid sequence)" />
        <LegendItem color="var(--color-accent)"label="Current active state" />
        <span>→ Initial state arrow shown at q0</span>
        <span>○○ Dashed outer ring = accepting state</span>
      </div>
      <div style={{ fontSize: '.72rem', color: 'var(--color-text-muted)', padding: '0 4px 8px' }}>
        Diagram shows key transitions only. Full transition table available in the Transition Table tab.
      </div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${color}`, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function Edge({ from, to, label, bend = 0, isActive }) {
  // Compute control point for curved edges
  const dx = to.x - from.x
  const dy = to.y - from.y
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const len = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular offset for curve
  const px = -dy / len * bend
  const py =  dx / len * bend
  const cx = mx + px
  const cy = my + py

  // Adjust start/end to circle edges
  const angle1 = Math.atan2(cy - from.y, cx - from.x)
  const angle2 = Math.atan2(to.y - cy, to.x - cx)
  const sx = from.x + Math.cos(angle1) * R
  const sy = from.y + Math.sin(angle1) * R
  const ex = to.x   - Math.cos(angle2) * R
  const ey = to.y   - Math.sin(angle2) * R

  const stroke = isActive ? 'var(--color-accent)' : '#c9d3de'
  const strokeW = isActive ? 2 : 1.2

  return (
    <g className={`dfa-edge ${isActive ? 'active' : ''}`}>
      {bend !== 0 ? (
        <path
          d={`M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`}
          fill="none" stroke={stroke} strokeWidth={strokeW}
          markerEnd={`url(#${isActive ? 'arrow-active' : 'arrow'})`}
        />
      ) : (
        <line
          x1={sx} y1={sy} x2={ex} y2={ey}
          stroke={stroke} strokeWidth={strokeW}
          markerEnd={`url(#${isActive ? 'arrow-active' : 'arrow'})`}
        />
      )}
      <text
        x={cx || mx} y={(cy || my) - 5}
        textAnchor="middle" fontSize="8"
        fill={isActive ? 'var(--color-accent)' : 'var(--color-text-muted)'}
        fontWeight={isActive ? '600' : '400'}
      >
        {label.length > 18 ? label.slice(0,17) + '…' : label}
      </text>
    </g>
  )
}
