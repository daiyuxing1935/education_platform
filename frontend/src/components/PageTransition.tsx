import { useLocation } from 'react-router-dom'

/**
 * Wraps page content with a fade-in animation that replays
 * whenever the route (pathname) changes.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div
      key={location.pathname}
      className="page-transition"
      style={{
        animation: 'pageFadeIn 0.35s ease-out forwards',
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  )
}
