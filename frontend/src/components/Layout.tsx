import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <main style={{ height: '100vh', overflow: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  )
}
