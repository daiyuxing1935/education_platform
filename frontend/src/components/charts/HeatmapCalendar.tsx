import { useMemo, useState, useCallback } from 'react'

interface HeatmapCalendarProps {
  data: { date: string; count: number }[]
  className?: string
}

const CELL_SIZE = 14
const CELL_GAP = 3
const CELL_STEP = CELL_SIZE + CELL_GAP
const LABEL_WIDTH = 32

const COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']

function getLevel(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

const WEEKDAY_LABELS: Record<number, string> = {
  0: '周一',
  2: '周三',
  4: '周五',
}

const MONTH_NAMES = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月']

export default function HeatmapCalendar({ data, className }: HeatmapCalendarProps) {
  const [tooltip, setTooltip] = useState<{ date: Date; count: number; x: number; y: number } | null>(null)
  const [showActivitySettings, setShowActivitySettings] = useState(false)

  const { cells, monthLabels, totalCount, cols } = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const d of data) countMap.set(d.date, d.count)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rangeStart = new Date(today)
    rangeStart.setDate(rangeStart.getDate() - 364)
    const rangeEnd = new Date(today)
    rangeEnd.setHours(23, 59, 59, 999)

    // Align grid start to Monday
    const gridStart = new Date(rangeStart)
    const startDay = gridStart.getDay()
    const monOffset = startDay === 0 ? -6 : 1 - startDay
    gridStart.setDate(gridStart.getDate() + monOffset)

    // Align grid end to Sunday
    const gridEnd = new Date(rangeEnd)
    const endDay = gridEnd.getDay()
    const sunOffset = endDay === 0 ? 0 : 7 - endDay
    gridEnd.setDate(gridEnd.getDate() + sunOffset)

    const cols = Math.round((gridEnd.getTime() - gridStart.getTime()) / (86400000 * 7)) + 1

    const cells: { date: Date; count: number; level: number; inRange: boolean }[][] = Array.from({ length: 7 }, () => [])
    const monthColMap = new Map<string, number>()
    let totalCount = 0

    const rangeStartTime = rangeStart.getTime()
    const rangeEndTime = rangeEnd.getTime()

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < 7; row++) {
        const date = new Date(gridStart)
        date.setDate(date.getDate() + col * 7 + row)
        const dateTime = date.getTime()
        const inRange = dateTime >= rangeStartTime && dateTime <= rangeEndTime

        const key = date.toISOString().slice(0, 10)
        const count = inRange ? (countMap.get(key) || 0) : 0
        if (inRange) totalCount += count

        cells[row].push({ date: new Date(date), count, level: getLevel(count), inRange })

        if (inRange && date.getDate() === 1) {
          const ymKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          if (!monthColMap.has(ymKey)) {
            monthColMap.set(ymKey, col)
          }
        }
      }
    }

    // Sort by column position (chronological order), show all months
    const rawMonths = Array.from(monthColMap.entries()).sort((a, b) => a[1] - b[1])
    const monthLabels: { label: string; col: number }[] = []
    let lastCol = -3
    for (const [ymKey, col] of rawMonths) {
      const monthIdx = parseInt(ymKey.split('-')[1]) - 1
      if (col - lastCol >= 1) {
        monthLabels.push({ label: MONTH_NAMES[monthIdx], col })
        lastCol = col
      }
    }

    return { cells, monthLabels, totalCount, cols }
  }, [data])

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, date: Date, count: number) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      date,
      count,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip(prev => prev ? {
      ...prev,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    } : null)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  const formatDate = (d: Date) => {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    return `${y} 年 ${m} 月 ${day} 日`
  }

  if (!data.length) {
    return (
      <div className={className} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '140px', color: 'var(--app-text-placeholder)', fontSize: '0.875rem',
      }}>
        暂无学习记录
      </div>
    )
  }

  const gridWidth = cols * CELL_STEP

  return (
    <div
      className={className}
      style={{
        width: '100%',
        minWidth: '800px',
        maxWidth: '1200px',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        margin: '0 auto',
        fontFamily: 'var(--font-body), system-ui, sans-serif',
      }}
    >
      <style>{`
        .heatmap-cell:hover {
          transform: scale(1.1) !important;
        }
      `}</style>

      {/* Title bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '16px', color: '#4b5563' }}>
          过去一年共 <span style={{ fontWeight: 700, fontSize: '20px', color: '#111827' }}>{totalCount}</span> 次学习记录
        </div>
        <div
          onClick={() => setShowActivitySettings(!showActivitySettings)}
          style={{
            color: 'var(--app-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '14px',
            position: 'relative',
            userSelect: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--app-bg-page)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          活跃度设置
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ transition: 'transform 0.2s', transform: showActivitySettings ? 'rotate(180deg)' : 'rotate(0)' }}>
            <path d="M6 8L2 4h8z" />
          </svg>
          {showActivitySettings && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '4px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              padding: '10px 12px',
              zIndex: 200,
              minWidth: '140px',
              cursor: 'default',
            }}>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>活跃度等级</div>
              {[
                { color: COLORS[1], label: '1-2 次', desc: '低活跃' },
                { color: COLORS[2], label: '3-4 次', desc: '中等活跃' },
                { color: COLORS[3], label: '5-7 次', desc: '高活跃' },
                { color: COLORS[4], label: '8+ 次', desc: '极高活跃' },
              ].map(level => (
                <div key={level.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '12px', color: '#4b5563' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: level.color, flexShrink: 0 }} />
                  <span>{level.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: '11px' }}>{level.desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid area */}
      <div style={{ position: 'relative', overflow: 'auto' }}>
        {/* Month labels */}
        <div style={{
          position: 'relative',
          marginLeft: `${LABEL_WIDTH}px`,
          height: '20px',
          width: `${gridWidth}px`,
          minWidth: 'max-content',
        }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${m.col * CELL_STEP}px`,
                fontSize: '14px',
                color: 'var(--app-text-secondary)',
                lineHeight: '20px',
              }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Grid body */}
        <div style={{ display: 'flex' }}>
          {/* Weekday labels */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: `${LABEL_WIDTH}px`,
            flexShrink: 0,
            gap: `${CELL_GAP}px`,
            paddingTop: '1px',
          }}>
            {[0, 1, 2, 3, 4, 5, 6].map(row => (
              <div key={row} style={{
                height: `${CELL_SIZE}px`,
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                color: 'var(--app-text-secondary)',
              }}>
                {WEEKDAY_LABELS[row] ?? ''}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${CELL_GAP}px`,
          }}>
            {cells.map((row, rowIdx) => (
              <div key={rowIdx} style={{
                display: 'flex',
                gap: `${CELL_GAP}px`,
              }}>
                {row.map((cell, colIdx) => (
                  <div
                    key={colIdx}
                    className="heatmap-cell"
                    style={{
                      width: `${CELL_SIZE}px`,
                      height: `${CELL_SIZE}px`,
                      borderRadius: '2px',
                      background: cell.inRange ? COLORS[cell.level] : 'transparent',
                      transition: 'transform 0.2s',
                      cursor: cell.inRange ? 'pointer' : 'default',
                      flexShrink: 0,
                    }}
                    onMouseEnter={cell.inRange ? (e) => handleMouseEnter(e, cell.date, cell.count) : undefined}
                    onMouseMove={cell.inRange ? handleMouseMove : undefined}
                    onMouseLeave={cell.inRange ? handleMouseLeave : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'fixed',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
            background: '#1f2937',
            color: 'white',
            fontSize: '12px',
            padding: '8px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 1000,
            lineHeight: '1.5',
          }}>
            <div>{formatDate(tooltip.date)}</div>
            <div>{tooltip.count} 次学习记录</div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '12px',
      }}>
        <a href="#" style={{
          color: '#0969da',
          fontSize: '14px',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline' }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none' }}
        >
          了解如何统计活跃度
        </a>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '14px',
          color: 'var(--app-text-secondary)',
        }}>
          <span>Less</span>
          {COLORS.map((c, i) => (
            <div key={i} style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              background: c,
            }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
