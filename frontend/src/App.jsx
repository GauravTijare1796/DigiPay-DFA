import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Payment from './pages/Payment.jsx'
import DFASimulator from './pages/DFASimulator.jsx'
import History from './pages/History.jsx'
import TransactionDetail from './pages/TransactionDetail.jsx'
import Theory from './pages/Theory.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"                      element={<Home />} />
        <Route path="/payment"               element={<Payment />} />
        <Route path="/simulator"             element={<DFASimulator />} />
        <Route path="/history"               element={<History />} />
        <Route path="/history/:id"           element={<TransactionDetail />} />
        <Route path="/theory"                element={<Theory />} />
        <Route path="*"                      element={<NotFound />} />
      </Route>
    </Routes>
  )
}
