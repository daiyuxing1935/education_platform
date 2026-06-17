/**
 * 学习路径阶段指示器组件
 *
 * 展示路径的 5 个阶段流转：诊断 → 学习 → 练习 → 复习 → 完成
 * 当前阶段高亮，已完成阶段显示对勾
 */
import { memo } from 'react'
import { CheckCircleIcon, TargetIcon, BookOpenIcon, EditIcon, RefreshIcon, FlagIcon } from './Icons'

export type PathPhase = 'diagnosis' | 'learning' | 'practice' | 'review' | 'completed'

interface PhaseInfo {
  key: PathPhase
  label: string
  icon: React.ReactNode
  description: string
}

const PHASES: PhaseInfo[] = [
  { key: 'diagnosis', label: '诊断', icon: <TargetIcon size={14} />, description: 'AI 分析画像' },
  { key: 'learning', label: '学习', icon: <BookOpenIcon size={14} />, description: '按序学知识点' },
  { key: 'practice', label: '练习', icon: <EditIcon size={14} />, description: '做题巩固' },
  { key: 'review', label: '复习', icon: <RefreshIcon size={14} />, description: '艾宾浩斯复习' },
  { key: 'completed', label: '完成', icon: <FlagIcon size={14} />, description: '路径完成' },
]

const PHASE_INDEX: Record<PathPhase, number> = {
  diagnosis: 0,
  learning: 1,
  practice: 2,
  review: 3,
  completed: 4,
}

interface PathPhaseIndicatorProps {
  currentPhase: PathPhase
  progress?: { total: number; completed: number; percentage: number }
  goalDescription?: string
}

function PathPhaseIndicatorInner({ currentPhase, progress, goalDescription }: PathPhaseIndicatorProps) {
  const currentIdx = PHASE_INDEX[currentPhase] ?? 0

  return (
    <div style={{
      background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 50%, #F0FDF4 100%)',
      borderRadius: 12,
      padding: '16px 20px',
      border: '1px solid #E2E8F0',
      marginBottom: 12,
    }}>
      {/* 目标描述 */}
      {goalDescription && (
        <div style={{ fontSize: 11, color: '#6366F1', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <TargetIcon size={11} /> 目标：{goalDescription}
        </div>
      )}

      {/* 阶段指示器 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {PHASES.map((phase, idx) => {
          const isDone = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isFuture = idx > currentIdx

          return (
            <div key={phase.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              {/* 节点 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                flex: 1,
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDone ? '#10B981' : isCurrent ? '#6366F1' : '#E2E8F0',
                  color: isDone || isCurrent ? '#fff' : '#94A3B8',
                  fontSize: 13,
                  fontWeight: 700,
                  transition: 'all 0.3s ease',
                  boxShadow: isCurrent ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
                }}>
                  {isDone ? <CheckCircleIcon size={14} /> : phase.icon}
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isDone ? '#10B981' : isCurrent ? '#6366F1' : '#94A3B8',
                  whiteSpace: 'nowrap',
                }}>
                  {phase.label}
                </span>
                <span style={{ fontSize: 8, color: '#CBD5E1', display: 'none' }}>{phase.description}</span>
              </div>

              {/* 连接线（最后一个不画） */}
              {idx < PHASES.length - 1 && (
                <div style={{
                  flex: '0 0 24px',
                  height: 2,
                  background: isDone ? '#10B981' : '#E2E8F0',
                  margin: '0 -2px',
                  marginBottom: 14,
                  transition: 'background 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* 进度条 */}
      {progress && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6366F1' }}>
              {PHASES[currentIdx]?.label}阶段
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: progress.percentage >= 80 ? '#10B981' : progress.percentage >= 40 ? '#F59E0B' : '#6366F1' }}>
              {progress.completed}/{progress.total} 已完成 ({progress.percentage}%)
            </span>
          </div>
          <div style={{ height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, progress.percentage)}%`,
              background: progress.percentage >= 80
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : progress.percentage >= 40
                  ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                  : 'linear-gradient(90deg, #6366F1, #818CF8)',
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

export const PathPhaseIndicator = memo(PathPhaseIndicatorInner)
