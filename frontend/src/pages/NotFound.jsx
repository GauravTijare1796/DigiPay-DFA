import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page-body">
      <div className="empty-state" style={{ marginTop: 60 }}>
        <div style={{ fontSize: '3rem', marginBottom: 12, opacity: .3 }}>404</div>
        <h3>Page not found</h3>
        <p>This route doesn't exist in DigiPay-DFA.</p>
        <Link to="/" className="btn btn-primary">Back to Overview</Link>
      </div>
    </div>
  )
}
