import { NavLink, Outlet } from 'react-router-dom'
import { Home, CreditCard, GitBranch, Clock, BookOpen } from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Overview',      icon: Home },
  { to: '/payment',   label: 'Make Payment',  icon: CreditCard },
  { to: '/simulator', label: 'DFA Simulator', icon: GitBranch },
  { to: '/history',   label: 'History',       icon: Clock },
  { to: '/theory',    label: 'Theory / DFA',  icon: BookOpen },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">DigiPay-DFA</div>
          <div className="sidebar-brand-sub">DFA Payment Simulator · TY ToC Project</div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-label">Application</div>
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          Academic simulation only.<br />
          No real money involved.
        </div>
      </aside>

      <main className="main-content" id="main">
        <Outlet />
        <footer style={{ padding: '16px 32px', borderTop: '1px solid var(--color-border)', fontSize: '.72rem', color: 'var(--color-text-light)' }}>
          DigiPay-DFA — TY Software Engineering · Theory of Computation Project · All accounts and transactions are fictional simulations.
        </footer>
      </main>
    </div>
  )
}
