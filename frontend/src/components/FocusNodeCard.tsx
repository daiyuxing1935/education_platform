/**
 * 焦点节点卡片 — AI 推荐的"此刻最该学"知识点
 *
 * 以大号卡片突出显示当前焦点节点，包含：
 * - 节点名称和掌握度
 * - 推荐理由（来自 Agent）
 * - 快速操作：开始学习、直接练习、跳过、换个推荐
 * - 备选推荐列表
 */
import { memo } from 'react'
import { BotIcon, EditIcon, ArrowRightIcon, ZapIcon, CheckIcon } from './Icons'
import type { CurrentNodeInfo, NodeOrderItem } from '../api/path'

interface FocusNodeCardProps {
  currentNode: CurrentNodeInfo | null
  alternatives?: NodeOrderItem[]
  onStudy: (nodeId: string) => void
  onPractice: (nodeId: string) => void
  onSkip: (nodeId: string) => void
  loading?: boolean
  /** 该节点前的已完成节点名列表（用于展示前置完成状态） */
  prevCompletedNames?: string[]
}

const MASTERY_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981', '#059669']

function FocusNodeCardInner({
  currentNode,
  alternatives,
  onStudy,
  onPractice,
  onSkip,
  loading,
  prevCompletedNames,
}: FocusNodeCardProps) {
  if (loading) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1.5px solid #E2E8F0',
        padding: 20,
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 13,
        marginBottom: 12,
      }}>
        正在分析学习数据，推荐最佳学习路径...
      </div>
    )
  }

  if (!currentNode) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1.5px solid #E2E8F0',
        padding: 20,
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 13,
        marginBottom: 12,
      }}>
        <div style={{ marginBottom: 4 }}>🎉 所有知识点已完成！</div>
        <div style={{ fontSize: 11 }}>可以初始化新的学习目标，或等待复习提醒</div>
      </div>
    )
  }

  const m = currentNode.mastery_score / 100
  const masteryColor = MASTERY_COLORS[Math.min(5, Math.floor(m * 6))]
  const isWeak = m < 0.4

  return (
    <div style={{ marginBottom: 12 }}>
      {/* 主卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F9FF 100%)',
        borderRadius: 14,
        border: '2px solid #BFDBFE',
        padding: 0,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(59,130,246,0.08)',
      }}>
        {/* 卡片头 */}
        <div style={{
          background: 'linear-gradient(90deg, #2563EB, #3B82F6)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <BotIcon size={14} />
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>AI 推荐 — 此刻最该学这个</span>
        </div>

        {/* 卡片内容 */}
        <div style={{ padding: '16px 18px' }}>
          {/* 节点名称和掌握度 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>
                📖 {currentNode.name}
              </div>
              {currentNode.domain_name && (
                <div style={{ fontSize: 11, color: '#64748B' }}>{currentNode.domain_name}</div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: masteryColor }}>
                {currentNode.mastery_score}%
              </div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>掌握度</div>
            </div>
          </div>

          {/* 掌握度条 */}
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, currentNode.mastery_score)}%`,
              background: masteryColor,
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>

          {/* 推荐理由 */}
          <div style={{
            padding: '8px 12px',
            background: '#F0FDF4',
            borderRadius: 8,
            border: '1px solid #BBF7D0',
            fontSize: 12,
            color: '#065F46',
            lineHeight: 1.6,
            marginBottom: 12,
          }}>
            💡 {currentNode.reason || '按学习顺序推荐的下一个知识点'}
            {isWeak && (
              <span style={{ display: 'block', marginTop: 4, color: '#DC2626', fontSize: 11 }}>
                ⚠️ 当前掌握度较低，建议优先学习
              </span>
            )}
          </div>

          {/* 前置完成状态 */}
          {prevCompletedNames && prevCompletedNames.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: '#10B981',
              marginBottom: 10,
              flexWrap: 'wrap',
            }}>
              <CheckIcon size={10} />
              前置已完成：{prevCompletedNames.map(name => (
                <span key={name} style={{
                  padding: '1px 6px',
                  background: '#DCFCE7',
                  borderRadius: 4,
                  color: '#065F46',
                  fontWeight: 500,
                }}>{name}</span>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => onStudy(currentNode.node_id)}
              style={{
                flex: '1 1 auto',
                minWidth: 100,
                padding: '10px 16px',
                background: '#2563EB',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1D4ED8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563EB')}
            >
              <BookIcon size={13} /> 开始学习
            </button>
            <button
              onClick={() => onPractice(currentNode.node_id)}
              style={{
                flex: '1 1 auto',
                minWidth: 100,
                padding: '10px 16px',
                background: '#fff',
                color: '#475569',
                border: '1.5px solid #CBD5E1',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <EditIcon size={13} /> 直接练习
            </button>
            <button
              onClick={() => onSkip(currentNode.node_id)}
              style={{
                padding: '10px 14px',
                background: 'transparent',
                color: '#94A3B8',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <ArrowRightIcon size={12} /> 跳过
            </button>
          </div>
        </div>
      </div>

      {/* 备选推荐 */}
      {alternatives && alternatives.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: '#F8FAFC',
          borderRadius: 8,
          border: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <ZapIcon size={10} /> 备选：
          </span>
          {alternatives.map(alt => (
            <button
              key={alt.node_id}
              onClick={() => onStudy(alt.node_id)}
              style={{
                padding: '3px 10px',
                background: '#fff',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                fontSize: 11,
                color: '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#475569' }}
            >
              {alt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export const FocusNodeCard = memo(FocusNodeCardInner)

/** 小号书图标，用于 FocusNodeCard 内部 */
function BookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
