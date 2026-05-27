import { useState, useRef, useCallback } from 'react'

interface DraggableWindowProps {
  title: string
  visible: boolean
  onClose: () => void
  defaultWidth?: number
  defaultHeight?: number
  defaultX?: number
  defaultY?: number
  minWidth?: number
  minHeight?: number
  children: React.ReactNode
}

export default function DraggableWindow({
  title, visible, onClose,
  defaultWidth = 600, defaultHeight = 400,
  defaultX = 100, defaultY = 80,
  minWidth = 300, minHeight = 200,
  children,
}: DraggableWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight })
  const [position, setPosition] = useState({ x: defaultX, y: defaultY })
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)

  const onMouseDownTitle = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: position.x, startTop: position.y }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [position, isMaximized])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPosition({
      x: Math.max(0, dragRef.current.startLeft + dx),
      y: Math.max(0, dragRef.current.startTop + dy),
    })
  }, [])

  const onMouseUp = useCallback(() => {
    dragRef.current = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }, [onMouseMove])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: size.width, startH: size.height }
    const onResizeMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      setSize({
        width: Math.max(minWidth, resizeRef.current.startW + dx),
        height: Math.max(minHeight, resizeRef.current.startH + dy),
      })
    }
    const onResizeUp = () => {
      resizeRef.current = null
      document.removeEventListener('mousemove', onResizeMove)
      document.removeEventListener('mouseup', onResizeUp)
    }
    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeUp)
  }, [size, minWidth, minHeight])

  if (!visible) return null

  const windowStyle: React.CSSProperties = isMaximized
    ? { position: 'fixed', inset: 0, zIndex: 500 }
    : {
      position: 'fixed',
      left: position.x, top: position.y,
      width: size.width, height: size.height,
      zIndex: 500,
    }

  return (
    <div ref={windowRef} style={{
      ...windowStyle,
      background: '#fff', borderRadius: 12,
      boxShadow: '0 8px 40px rgba(0,0,0,0.18), 0 2px 10px rgba(0,0,0,0.1)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      border: '1px solid #E5E7EB',
    }}>
      {/* Title bar */}
      <div
        onMouseDown={onMouseDownTitle}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'var(--app-bg-card-alt)', borderBottom: '1px solid #E5E7EB',
          cursor: isMaximized ? 'default' : 'move', userSelect: 'none',
          flexShrink: 0,
        }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--app-text-heading)' }}>{title}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setIsMaximized(!isMaximized)}
            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '14px', color: 'var(--app-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={isMaximized ? '还原' : '最大化'}>
            {isMaximized ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="5" width="14" height="14" rx="2"/><polyline points="15 9 9 9 9 15"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            )}
          </button>
          <button onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: 'var(--app-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {children}
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          onMouseDown={(e) => onResizeStart(e)}
          style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 16, height: 16, cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, #D1D5DB 50%)',
            borderBottomRightRadius: 12,
          }}
        />
      )}
    </div>
  )
}
