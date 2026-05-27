import { useState, useEffect, useCallback, useRef } from 'react'

interface ChatSession {
  id: string
  title: string
  model: string
  updated_at: string
}

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
  currentChatId: string | null
  onSelectChat: (chatId: string | null) => void
  onNewChat: () => void
  sessions: ChatSession[]
  onDeleteChat: (chatId: string) => void
  onSearch: (query: string) => void
  searchQuery: string
  favorites?: Record<string, number>
  onToggleFavorite?: (chatId: string) => void
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export default function Sidebar({
  isOpen,
  onToggle,
  currentChatId,
  onSelectChat,
  onNewChat,
  sessions,
  onDeleteChat,
  onSearch,
  searchQuery,
  favorites = {},
  onToggleFavorite,
}: SidebarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setLocalQuery(value)
    onSearch(value)
  }, [onSearch])

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault()
    setContextMenu({ chatId, x: e.clientX, y: e.clientY })
  }

  const handleContextAction = (action: 'favorite' | 'unfavorite' | 'delete') => {
    if (!contextMenu) return
    const { chatId } = contextMenu
    setContextMenu(null)

    if (action === 'favorite' || action === 'unfavorite') {
      onToggleFavorite?.(chatId)
    } else if (action === 'delete') {
      onDeleteChat(chatId)
    }
  }

  const displayedSessions = showFavoritesOnly
    ? sessions.filter(s => favorites[s.id])
    : sessions

  const favCount = Object.keys(favorites).length

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '56px',
          left: 0,
          width: isOpen ? '220px' : '0',
          height: 'calc(100vh - 56px)',
          backgroundColor: 'white',
          borderRight: isOpen ? '1px solid var(--gray-100)' : 'none',
          transition: 'width var(--transition-slow)',
          overflow: 'hidden',
          zIndex: 100,
          boxShadow: isOpen ? 'var(--shadow-md)' : 'none',
        }}
      >
        <div
          style={{
            width: '220px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: 'var(--space-4)',
            overflow: 'hidden',
          }}
        >
          {/* Search + New Chat */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--gray-200)',
              backgroundColor: 'white',
              transition: 'border-color var(--transition-fast)',
            }}>
              <SearchIcon />
              <input
                type="text"
                placeholder="搜索对话..."
                value={localQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--gray-700)',
                  fontSize: '0.8125rem',
                  fontFamily: 'var(--font-body)',
                }}
              />
            </div>
            <button
              onClick={onNewChat}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'white',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast), transform var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-dark)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              title="新建对话"
            >
              <PlusIcon />
            </button>
          </div>

          {/* Favorites filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-2)',
            padding: '0 var(--space-1)',
          }}>
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: showFavoritesOnly ? 'oklch(0.55 0.2 50 / 0.12)' : 'transparent',
                color: showFavoritesOnly ? '#e67e22' : 'var(--gray-400)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: showFavoritesOnly ? 600 : 400,
                transition: 'all 0.15s',
              }}
              title={showFavoritesOnly ? '显示全部对话' : '仅显示收藏对话'}
            >
              <StarIcon filled={showFavoritesOnly || favCount > 0} />
              {showFavoritesOnly ? '收藏夹' : '收藏'}
              {favCount > 0 && !showFavoritesOnly && (
                <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>({favCount})</span>
              )}
            </button>
            {showFavoritesOnly && (
              <button
                onClick={() => setShowFavoritesOnly(false)}
                style={{ border: 'none', background: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px' }}
              >
                全部
              </button>
            )}
          </div>

          {/* Chat list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {displayedSessions.length === 0 ? (
              <div className="empty-state" style={{ paddingTop: 'var(--space-6)' }}>
                <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem' }}>
                  {showFavoritesOnly ? '暂无收藏对话' : searchQuery ? '未找到匹配的对话' : '暂无对话记录'}
                </p>
              </div>
            ) : (
              displayedSessions.map((session) => {
                const isFav = !!favorites[session.id]
                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectChat(session.id)}
                    onContextMenu={(e) => handleContextMenu(e, session.id)}
                    className="slide-in"
                    style={{
                      padding: 'var(--space-3)',
                      marginBottom: 'var(--space-2)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: currentChatId === session.id ? 'oklch(0.55 0.25 250 / 0.08)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                      border: currentChatId === session.id ? '1px solid oklch(0.55 0.25 250 / 0.15)' : '1px solid transparent',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (currentChatId !== session.id) {
                        e.currentTarget.style.backgroundColor = 'var(--gray-50)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentChatId !== session.id) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}>
                        {isFav && (
                          <span style={{ color: '#e67e22', fontSize: '0.7rem', flexShrink: 0 }}>★</span>
                        )}
                        <div style={{
                          fontSize: '0.8125rem',
                          color: 'var(--gray-700)',
                          fontWeight: currentChatId === session.id ? 500 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.4,
                        }}>
                          {session.title}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteChat(session.id)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          color: 'var(--gray-400)',
                          cursor: 'pointer',
                          borderRadius: 'var(--radius-sm)',
                          opacity: 0,
                          transition: 'opacity var(--transition-fast), color var(--transition-fast)',
                          flexShrink: 0,
                        }}
                        className="delete-btn"
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
                        title="删除对话"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--gray-400)',
                      marginTop: 'var(--space-1)',
                    }}>
                      {formatTime(session.updated_at)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'white',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--gray-100)',
            zIndex: 2000,
            minWidth: '120px',
            overflow: 'hidden',
          }}
        >
          {favorites[contextMenu.chatId] ? (
            <button
              onClick={() => handleContextAction('unfavorite')}
              style={{
                width: '100%',
                padding: '8px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: '#e67e22',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <StarIcon filled /> 取消收藏
            </button>
          ) : (
            <>
              <button
                onClick={() => handleContextAction('favorite')}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  color: 'var(--gray-700)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <StarIcon /> 收藏对话
              </button>
              <button
                onClick={() => handleContextAction('delete')}
                style={{
                  width: '100%',
                  padding: '8px 14px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderTop: '1px solid var(--gray-100)',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                删除对话
              </button>
            </>
          )}
        </div>
      )}

      <style>{`
        div:hover > .delete-btn { opacity: 1; }
      `}</style>

      <button
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: '70px',
          left: isOpen ? '220px' : '10px',
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid var(--gray-200)',
          backgroundColor: 'white',
          color: 'var(--gray-500)',
          cursor: 'pointer',
          transition: 'left var(--transition-slow), box-shadow var(--transition-fast), transform var(--transition-fast)',
          zIndex: 101,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          e.currentTarget.style.color = 'var(--gray-700)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
          e.currentTarget.style.color = 'var(--gray-500)'
        }}
        title={isOpen ? '收起侧边栏' : '展开侧边栏'}
      >
        {isOpen ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
      </button>
    </>
  )
}
