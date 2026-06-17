/**
 * 学科学习路径页 — V3 动态学习路径 + 性能优化版
 *
 * 改动：
 * - 合并 API 调用（pathState + pathNodes 并行加载）
 * - 消除 loadPathAndRecommendations 对 chatMessages.length 的依赖
 * - 聊天历史 debounce 保存到 localStorage（5s 防抖）
 * - 第二次进入自动跳过选择器（有活跃路径时）
 * - visibilitychange 监听器稳定化
 */
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathApi, type PathStateData, type KnowledgePointRecordResponse } from '../api/path'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { PathPhaseIndicator, type PathPhase } from '../components/PathPhaseIndicator'
import { FocusNodeCard } from '../components/FocusNodeCard'
import { BookIcon, BotIcon, RocketIcon, TargetIcon, FlagIcon, EditIcon, CheckIcon, CheckCircleIcon, RefreshIcon, ArrowRightIcon, ZapIcon } from '../components/Icons'
import { STATUS_LABELS } from '../constants/labels'

/* ── Icons ── */
function BackIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
}

const MASTERY_COLORS = ['var(--app-danger)', '#F97316', 'var(--app-warning)', '#22C55E', 'var(--app-success)', 'var(--app-green-dark)']

/* ── 稳定常量（避免组件内重建） ── */
const QUICK_ACTIONS = [
  { label: '我当前最该学什么？', icon: <TargetIcon size={11} /> },
  { label: '这个知识点掌握了吗？', icon: <CheckCircleIcon size={11} /> },
  { label: '给我推荐练习题', icon: <EditIcon size={11} /> },
  { label: '调整学习路径', icon: <RefreshIcon size={11} /> },
  { label: '跳过已掌握章节', icon: <ArrowRightIcon size={11} /> },
  { label: '我想多练薄弱点', icon: <ZapIcon size={11} /> },
]

/* ── Streaming helpers ── */
function appendChunk(prev: Array<{ role: string; text: string }>, text: string) {
  const msgs = [...prev]
  if (msgs.length === 0) msgs.push({ role: 'assistant', text: '' })
  const last = msgs[msgs.length - 1]
  msgs[msgs.length - 1] = { role: last.role, text: (last?.text || '') + text }
  return msgs
}

async function streamChatCompletions(
  body: object,
  callbacks: { onChunk: (text: string) => void; onDone?: () => void; onError?: (msg: string) => void },
) {
  const token = localStorage.getItem('access_token')
  let response: Response
  try {
    response = await fetch('/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
    })
  } catch { callbacks.onError?.('网络请求失败'); return }
  if (!response.ok) { callbacks.onError?.(`请求失败: ${response.status}`); return }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      try {
        const event = JSON.parse(trimmed.slice(6))
        if (event.done) { callbacks.onDone?.(); return }
        if (event.content) callbacks.onChunk(event.content)
      } catch { /* skip */ }
    }
  }
  callbacks.onDone?.()
}

/* ═══════════════════════════════════════════════════
   Memoized sub-components to avoid large-tree re-renders
   ═══════════════════════════════════════════════════ */

const MemoSubjectCard = memo(function SubjectCard({
  subject, isSelected, onClick,
}: { subject: any; isSelected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{
        padding: '14px 16px', border: `2px solid ${isSelected ? 'var(--app-info)' : 'var(--app-border)'}`,
        borderRadius: 12, cursor: 'pointer', background: isSelected ? '#EFF6FF' : '#fff', transition: 'all 0.15s',
      }}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{subject.name}</div>
      {subject.description && <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 2 }}>{subject.description}</div>}
      <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>{subject.domains?.length || 0} 个知识领域</div>
    </div>
  )
})

const MemoChatMessage = memo(function ChatMessage({ msg }: { msg: { role: string; text: string } }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: 'var(--app-info)', color: '#fff', whiteSpace: 'pre-wrap' }}>
          {msg.text.split('\n').map((line, j) => <div key={j}>{line}</div>)}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 12, background: '#fff', border: '1px solid #E5E7EB', fontSize: 14, lineHeight: 1.7 }}>
        <MarkdownRenderer content={msg.text} />
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export default function SubjectLearningPage() {
  const navigate = useNavigate()

  // ── Refs (avoiding dep chains) ──
  const dataLoadedRef = useRef(false)
  const streamingRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subjectsRef = useRef<any[]>([])

  // ── Subject & Goal ──
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [goalInput, setGoalInput] = useState('')
  const [goal, setGoal] = useState('')
  const [showSubjectPicker, setShowSubjectPicker] = useState(true)
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [skipPickerChecked, setSkipPickerChecked] = useState(false)  // 是否已检查过是否跳过选择器

  // ── Path data ──
  const [pathNodes, setPathNodes] = useState<any[]>([])
  const [pathState, setPathState] = useState<PathStateData | null>(null)
  const [pathLoading, setPathLoading] = useState(false)
  const [expandedNode, setExpandedNode] = useState<string | null>(null)

  // ── Chat ──
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; text: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatMessagesRef = useRef(chatMessages)
  chatMessagesRef.current = chatMessages  // always current

  // ── 持久化辅助 ──
  const saveLearningSession = (subjectId: string, goalText: string) => {
    localStorage.setItem('learning_subject_id', subjectId)
    localStorage.setItem('learning_goal', goalText)
  }

  // ── Debounced chat history save ──
  const debouncedSaveChat = useCallback(() => {
    if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current)
    chatSaveTimerRef.current = setTimeout(() => {
      if (!showSubjectPicker && selectedSubject && chatMessagesRef.current.length > 0) {
        localStorage.setItem(`chat_history_${selectedSubject}`, JSON.stringify(chatMessagesRef.current))
      }
    }, 5000)  // 5s debounce
  }, [showSubjectPicker, selectedSubject])

  // 聊天消息变化 → debounce 保存
  useEffect(() => {
    if (!showSubjectPicker && selectedSubject && chatMessages.length > 0) {
      debouncedSaveChat()
    }
    return () => { if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current) }
  }, [chatMessages.length, showSubjectPicker, selectedSubject, debouncedSaveChat])

  // 滚动到底部（仅新消息时）
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  // ═══════════════════════════════════════════════════
  //  数据加载（合并为单次并行加载）
  // ═══════════════════════════════════════════════════

  const loadAllData = useCallback(async (subjectId: string) => {
    if (dataLoadedRef.current) return
    dataLoadedRef.current = true
    setPathLoading(true)

    const token = localStorage.getItem('access_token')
    const headers = { Authorization: `Bearer ${token}` }

    // 并行加载：subjects + pathState + pathNodes
    const [subjRes, stateRes, pathRes] = await Promise.allSettled([
      fetch('/api/v1/question-bank/subjects', { headers }).then(r => r.json()),
      pathApi.getPathState().then(r => r.data).catch(() => null),
      pathApi.getCurrentPath().then(r => r.data).catch(() => null),
    ])

    // 处理 subjects
    if (subjRes.status === 'fulfilled') {
      const subjList = subjRes.value?.subjects || []
      setSubjects(subjList)
      subjectsRef.current = subjList

      // 构建 domain→subject 映射
      const domainToSubject: Record<string, string> = {}
      for (const s of subjList) {
        for (const d of (s.domains || [])) domainToSubject[d.name] = s.id
      }

      // 处理 pathNodes
      if (pathRes.status === 'fulfilled' && pathRes.value?.nodes) {
        const allNodes = pathRes.value.nodes.map((n: any) => ({
          ...n,
          mastery: typeof n.mastery_score === 'number' ? n.mastery_score / 100 : (n.mastery || 0),
        }))
        const filtered = allNodes
          .filter((n: any) => domainToSubject[n.domain_name] === subjectId)
          .sort((a: any, b: any) => (a.domain_sort_order || 0) - (b.domain_sort_order || 0) || (a.sort_order || 0) - (b.sort_order || 0))
        setPathNodes(filtered)

        // 仅首次：基于真实数据显示学习概况
        if (chatMessagesRef.current.length === 0 && !streamingRef.current) {
          const hasRealData = filtered.some((n: any) => (n.mastery || 0) > 0)
          if (hasRealData) {
            // 有真实学习数据：展示实际统计
            const weak = filtered.filter((n: any) => (n.mastery || 0) > 0 && (n.mastery || 0) < 0.6)
            const weakNames = weak.map((n: any) => n.point_name || n.name).slice(0, 3).join('、')
            const mastered = filtered.filter((n: any) => (n.mastery || 0) >= 0.8).length
            setChatMessages([{
              role: 'assistant',
              text: `📊 **当前学习概况**：共 ${filtered.length} 个知识点\n` +
                (mastered > 0 ? `✅ 已掌握 ${mastered} 个\n` : '') +
                (weakNames ? `🔴 需加强：${weakNames}${weak.length > 3 ? ` 等 ${weak.length} 个` : ''}\n` : '') +
                `请查看左侧面板开始学习。`,
            }])
          } else {
            // 无学习数据：显示初始引导
            setChatMessages([{
              role: 'assistant',
              text: `📚 已加载 **${filtered.length}** 个知识点。\n\n` +
                `你还没有开始学习，系统已按知识体系排列好学习顺序。\n\n` +
                `💡 **建议**：从第一个知识点开始，点击「完成学习」逐步推进。`,
            }])
          }
        }
      } else if (chatMessagesRef.current.length === 0) {
        setChatMessages([{ role: 'assistant', text: '📚 欢迎回来！系统正在分析你的学习数据...' }])
      }
    }

    // 处理 pathState
    if (stateRes.status === 'fulfilled' && stateRes.value?.has_active_path && stateRes.value.state) {
      setPathState(stateRes.value.state)
    }

    setPathLoading(false)
  }, [])

  // ── 初始加载：检查是否应跳过选择器 ──
  useEffect(() => {
    const savedSubjectId = localStorage.getItem('learning_subject_id')
    const savedGoal = localStorage.getItem('learning_goal')

    // 恢复上次的选择
    if (savedSubjectId) setSelectedSubject(savedSubjectId)
    if (savedGoal) { setGoalInput(savedGoal); setGoal(savedGoal) }

    // 如果之前已有保存的科目和目标 → 直接进入学习视图
    if (savedSubjectId && savedGoal) {
      setShowSubjectPicker(false)
      setSkipPickerChecked(true)
    } else {
      setSkipPickerChecked(true)
    }

    loadSubjects()
  }, [])

  // subjects 加载完成后，如果已在学习视图 → 加载路径数据
  useEffect(() => {
    if (skipPickerChecked && !showSubjectPicker && subjects.length > 0 && selectedSubject) {
      loadAllData(selectedSubject)
    }
  }, [skipPickerChecked, showSubjectPicker, subjects.length, selectedSubject, loadAllData])

  const loadSubjects = useCallback(async () => {
    setSubjectLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/v1/question-bank/subjects', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setSubjects(data.subjects || [])
      subjectsRef.current = data.subjects || []
    } catch { setSubjects([]) }
    finally { setSubjectLoading(false) }
  }, [])

  // ── Visibility change: refresh on tab focus ──
  useEffect(() => {
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null
    const handleVisibility = () => {
      if (!document.hidden && !showSubjectPicker && !streamingRef.current) {
        // 防抖 1 秒，避免切回来立即请求
        if (visibilityTimer) clearTimeout(visibilityTimer)
        visibilityTimer = setTimeout(() => {
          dataLoadedRef.current = false
          if (selectedSubject) loadAllData(selectedSubject)
        }, 1000)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (visibilityTimer) clearTimeout(visibilityTimer)
    }
  }, [showSubjectPicker, selectedSubject, loadAllData])

  // ═══════════════════════════════════════════════════
  //  Actions
  // ═══════════════════════════════════════════════════

  const handleStartLearning = async () => {
    if (!selectedSubject || !goalInput.trim()) return
    const subj = subjectsRef.current.find((s: any) => s.id === selectedSubject)
    setGoal(goalInput.trim())
    saveLearningSession(selectedSubject, goalInput.trim())
    setShowSubjectPicker(false)
    dataLoadedRef.current = false

    // 恢复聊天历史
    const saved = localStorage.getItem(`chat_history_${selectedSubject}`)
    let restored: Array<{ role: string; text: string }> = []
    if (saved) { try { const p = JSON.parse(saved); if (Array.isArray(p)) restored = p } catch { } }

    if (restored.length === 0) {
      setChatMessages([{
        role: 'assistant',
        text: `📚 已设定科目「${subj?.name || ''}」，目标：${goalInput.trim()}\n\n正在为你分析学习路径...`,
      }])
    } else {
      setChatMessages(restored)
    }

    // 初始化路径状态
    try {
      const res = await pathApi.initPath({ subject_id: selectedSubject, goal_type: '', goal_description: goalInput.trim() })
      if (res.data) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: `✅ 学习路径已创建！共 ${res.data.total_nodes} 个知识点，系统已规划好学习顺序。`,
        }])
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '初始化路径失败'
      setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${detail}` }])
    }

    // 加载完整数据
    loadAllData(selectedSubject)
  }

  const handleCompleteNode = async (nodeId: string) => {
    try {
      await pathApi.updateProgress({ node_id: nodeId, action: 'complete' })
      dataLoadedRef.current = false
      await loadAllData(selectedSubject)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败'
      setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${detail}` }])
    }
  }

  const handleSkipNode = async (nodeId: string) => {
    try {
      await pathApi.updateProgress({ node_id: nodeId, action: 'skip' })
      dataLoadedRef.current = false
      await loadAllData(selectedSubject)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败'
      setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ ${detail}` }])
    }
  }

  const handleMarkStudy = async (pointId: string) => {
    try {
      await pathApi.recordKnowledgeStudy(pointId)
      setPathNodes(prev => prev.map(n =>
        (n.id === pointId || n.point_id === pointId) ? { ...n, mastery: Math.min(1, (n.mastery || 0) + 0.15) } : n,
      ))
    } catch { }
  }

  const handleRefreshPath = useCallback(async () => {
    setPathLoading(true)
    dataLoadedRef.current = false
    await loadAllData(selectedSubject)
    setPathLoading(false)
    setChatMessages(prev => [...prev, { role: 'assistant', text: '🔄 学习数据已刷新！' }])
  }, [selectedSubject, loadAllData])

  const handleModifyGoal = () => {
    if (selectedSubject) localStorage.removeItem(`chat_history_${selectedSubject}`)
    setShowSubjectPicker(true)
    setChatMessages([])
    setPathNodes([])
    setPathState(null)
    dataLoadedRef.current = false
  }

  const handlePractice = async (node: any) => {
    const pointId = node.point_id || node.id
    const token = localStorage.getItem('access_token')
    try {
      const res = await fetch(`/api/v1/question-bank/knowledge-points/${pointId}/practice-bank`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        navigate(`/banks/${data.bank_id}/practice?point=${encodeURIComponent(pointId)}`)
        return
      }
    } catch { }
    // 降级
    try {
      const domainName = node.domain_name
      const subj = subjectsRef.current.find((s: any) => (s.domains || []).some((d: any) => d.name === domainName))
      if (subj) {
        const banksRes = await fetch(`/api/v1/question-bank/banks?subject_id=${subj.id}&page_size=5`, { headers: { Authorization: `Bearer ${token}` } })
        const banksData = await banksRes.json()
        if (banksData.banks?.length > 0) { navigate(`/banks/${banksData.banks[0].id}/practice`); return }
      }
    } catch { }
    alert('该知识点暂无可练习的题目，请先在题库中创建相关题目')
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)
    streamingRef.current = true
    setChatMessages(prev => [...prev, { role: 'assistant', text: '' }])

    const subj = subjectsRef.current.find((s: any) => s.id === selectedSubject)
    const systemPrompt = `你是一个智能学习规划助手。当前科目：${subj?.name || '未选择'}，学习目标：${goal || '未设定'}。知识点总数：${pathNodes.length}。用中文回答，提供具体、可操作的建议。`

    const hasStreamed = { current: false }
    streamChatCompletions({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...chatMessagesRef.current.map(m => ({ role: m.role as 'user' | 'assistant', content: m.text })),
        { role: 'user', content: msg },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }, {
      onChunk(text) { hasStreamed.current = true; setChatMessages(prev => appendChunk(prev, text)) },
      onDone() { streamingRef.current = false; setChatLoading(false) },
      onError() {
        streamingRef.current = false; setChatLoading(false)
        if (!hasStreamed.current) {
          setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', text: '⚠️ AI服务暂未配置。请前往「API设置」页面配置AI密钥后再使用智能问答功能。' }])
        }
      },
    })
  }

  // ═══════════════════════════════════════════════════
  //  Derived data (memoized)
  // ═══════════════════════════════════════════════════

  const groupedNodes = useMemo(() => {
    const nodeStatusMap = new Map<string, string>()
    if (pathState?.node_order) {
      for (const n of pathState.node_order) nodeStatusMap.set(n.node_id, n.status)
    }
    return pathNodes
      .filter((n: any) => n.domain_name)
      .sort((a: any, b: any) => (a.domain_sort_order || 0) - (b.domain_sort_order || 0) || (a.sort_order || 0) - (b.sort_order || 0))
      .reduce((acc: any[], n: any) => {
        const last = acc[acc.length - 1]
        const nodeId = n.point_id || n.id
        const orderStatus = nodeStatusMap.get(nodeId)
        const nWithStatus = { ...n, orderStatus: orderStatus || 'pending' }
        if (last?.domain === n.domain_name) { last.nodes.push(nWithStatus); return acc }
        acc.push({ domain: n.domain_name, nodes: [nWithStatus] }); return acc
      }, [] as any[])
  }, [pathNodes, pathState?.node_order])

  const focusNodeFromData = useMemo(() => {
    if (pathState?.current_node) {
      return {
        node_id: pathState.current_node.node_id,
        name: pathState.current_node.name,
        domain_name: pathState.current_node.domain_name,
        mastery_score: pathState.current_node.mastery_score,
        status: 'active',
        reason: pathState.current_node.reason,
      }
    }
    const firstPending = pathNodes.find((n: any) => (n.mastery || 0) < 0.8)
    if (!firstPending) return null
    return {
      node_id: firstPending.point_id || firstPending.id,
      name: firstPending.point_name || firstPending.name,
      domain_name: firstPending.domain_name || '',
      mastery_score: Math.round((firstPending.mastery || 0) * 100),
      status: 'active',
      reason: '按学习顺序推荐的下一个知识点',
    }
  }, [pathState?.current_node, pathNodes])

  const alternatives = useMemo(() =>
    (pathState?.node_order || [])
      .filter(n => n.status === 'pending')
      .slice(0, 3)
    , [pathState?.node_order])

  const progressData = useMemo(() => {
    if (pathState?.progress && pathState.progress.total > 0) {
      return { total: pathState.progress.total, completed: pathState.progress.completed, percentage: pathState.progress.percentage }
    }
    const done = pathNodes.filter((n: any) => (n.mastery || 0) >= 0.8).length
    return { total: pathNodes.length, completed: done, percentage: pathNodes.length > 0 ? Math.round(done / pathNodes.length * 100) : 0 }
  }, [pathState?.progress, pathNodes])

  const subjectName = useMemo(() =>
    subjects.find(s => s.id === selectedSubject)?.name || '',
    [subjects, selectedSubject])

  // ═══════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg-card-alt)' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--app-text-secondary)' }}><BackIcon /></button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          {showSubjectPicker ? '设定学习目标' : <><TargetIcon size={16} /> {subjectName} 学习路径</>}
        </span>
        {!showSubjectPicker && goal && <span style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginLeft: 8 }}>目标：{goal}</span>}
        {!showSubjectPicker && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={handleRefreshPath} disabled={pathLoading}
              style={{ padding: '4px 12px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: 'var(--app-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: pathLoading ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              刷新
            </button>
            <button onClick={handleModifyGoal}
              style={{ padding: '4px 12px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: 'var(--app-text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <EditIcon size={12} /> 修改目标
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left: Path Board ── */}
        <div style={{ width: '45%', minWidth: 340, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: '#fff' }}>
          {/* Phase indicator + Focus card */}
          {!showSubjectPicker && (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E5E7EB', background: '#fff' }}>
              <PathPhaseIndicator
                currentPhase={(pathState?.phase || 'learning') as PathPhase}
                progress={progressData}
                goalDescription={pathState?.goal_description || goal}
              />
              <FocusNodeCard
                currentNode={focusNodeFromData}
                alternatives={alternatives}
                onStudy={handleCompleteNode}
                onPractice={handlePractice}
                onSkip={handleSkipNode}
                loading={pathLoading}
              />
            </div>
          )}

          {/* Subject Picker (first-time setup) */}
          {showSubjectPicker ? (
            <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}><BookIcon size={18} /> 选择你要学习的科目</h2>
              <p style={{ fontSize: 14, color: 'var(--app-text-secondary)', marginBottom: 20 }}>设定目标后，系统将自动诊断并规划学习路径</p>
              {subjectLoading ? <p style={{ color: 'var(--app-text-muted)' }}>加载中...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {subjects.filter((s: any) => s.name && s.domains?.length > 0).map((s: any) => (
                    <MemoSubjectCard key={s.id} subject={s} isSelected={selectedSubject === s.id} onClick={() => setSelectedSubject(s.id)} />
                  ))}
                </div>
              )}
              <input value={goalInput} onChange={e => { setGoalInput(e.target.value); setGoal(e.target.value) }}
                placeholder="输入学习目标，如：期末考试成绩达到90分"
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, outline: 'none', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleStartLearning} disabled={!selectedSubject || !goalInput.trim()}
                  style={{ flex: 1, padding: '12px', background: !selectedSubject || !goalInput.trim() ? 'var(--app-text-placeholder)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: !selectedSubject || !goalInput.trim() ? 'not-allowed' : 'pointer' }}>
                  <RocketIcon size={15} /> 开始学习
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {pathLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--app-text-muted)' }}>正在生成学习路径...</div>
              ) : groupedNodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--app-text-muted)' }}>暂无学习路径数据，先做一些练习吧</div>
              ) : (
                <div>
                  {groupedNodes.map((group: any, gi: number) => {
                    const grpDone = group.nodes.filter((n: any) =>
                      n.orderStatus === 'done' || (!n.orderStatus && (n.mastery || 0) >= 0.8),
                    ).length
                    return (
                      <div key={gi} style={{ marginBottom: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{group.domain}</span>
                          <span style={{ fontSize: 11, color: grpDone === group.nodes.length ? '#16A34A' : '#94A3B8', fontWeight: 600 }}>{grpDone}/{group.nodes.length} 完成</span>
                        </div>
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {group.nodes.map((node: any) => <MemoPathNode
                            key={node.id || node.point_id}
                            node={node}
                            isExpanded={expandedNode === (node.id || node.point_id)}
                            onToggle={() => setExpandedNode(expandedNode === (node.id || node.point_id) ? null : (node.id || node.point_id))}
                            onPractice={handlePractice}
                          />)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Chat ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--app-bg-card-alt)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {showSubjectPicker ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--app-text-muted)' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><TargetIcon size={48} /></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-text-secondary)' }}>选择科目并设定目标</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>系统将自动诊断并为你规划学习路径</div>
              </div>
            ) : (
              <>
                {chatMessages.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--app-text-muted)' }}>正在初始化诊断...</div>}
                {chatMessages.map((m, i) => <MemoChatMessage key={i} msg={m} />)}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {!showSubjectPicker && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #E5E7EB', background: '#fff' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                  placeholder="描述你的学习情况，或问：我当前最该学什么？"
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none' }} disabled={chatLoading} />
                <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                  style={{ padding: '10px 18px', background: chatLoading || !chatInput.trim() ? 'var(--app-text-placeholder)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer' }}>
                  {chatLoading ? '诊断中...' : '发送'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {QUICK_ACTIONS.map(({ label, icon }) => (
                  <button key={label} onClick={() => setChatInput(label)}
                    style={{ padding: '4px 10px', background: 'var(--app-bg-page)', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 11, color: 'var(--app-text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Memoized Path Node — 展开后：视频/练习/复习资料
   ═══════════════════════════════════════════════════ */

const MemoPathNode = memo(function PathNode({
  node, isExpanded, onToggle, onPractice,
}: {
  node: any
  isExpanded: boolean
  onToggle: () => void
  onPractice: (node: any) => void
}) {
  const m = node.mastery || 0
  const totalP = node.total_practiced || 0
  const totalC = node.total_correct || 0
  const accuracy = totalP > 0 ? Math.round(totalC / totalP * 100) : 0

  const isWeak = m > 0 && m < 0.4
  const hasData = totalP > 0

  const bgCard = '#fff'
  const borderCard = '#E2E8F0'

  const nodeId = node.id || node.point_id

  // 展开后详情数据
  const [detail, setDetail] = useState<KnowledgePointRecordResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [videoInput, setVideoInput] = useState('')
  const [videoSaving, setVideoSaving] = useState(false)
  const [reviewExpanded, setReviewExpanded] = useState(false)
  const [reviewGenerating, setReviewGenerating] = useState(false)
  const [reviewContent, setReviewContent] = useState<string | null>(null)

  // 展开时加载详情
  useEffect(() => {
    if (isExpanded && !detail && !detailLoading) {
      setDetailLoading(true)
      pathApi.getKnowledgeDetail(nodeId).then(r => {
        const d = r.data
        setDetail(d)
        setVideoInput(d.video_url || '')
        setReviewContent(d.review_material || null)
      }).catch(() => {}).finally(() => setDetailLoading(false))
    }
  }, [isExpanded, nodeId])

  const handleSaveVideo = async () => {
    if (!videoInput.trim()) return
    setVideoSaving(true)
    try {
      await pathApi.updateVideoUrl(nodeId, videoInput.trim())
      setDetail(prev => prev ? { ...prev, video_url: videoInput.trim() } : prev)
    } catch {}
    setVideoSaving(false)
  }

  const handleGenerateReview = async () => {
    setReviewGenerating(true)
    try {
      const res = await pathApi.generateReviewMaterial(nodeId)
      setReviewContent(res.data.content)
    } catch {}
    setReviewGenerating(false)
  }

  return (
    <div style={{ borderRadius: 8, border: `1.5px solid ${borderCard}`, background: bgCard, overflow: 'hidden', transition: 'all 0.15s' }}>
      {/* ── 卡片头部（可点击展开/折叠） ── */}
      <div style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{node.point_name || node.name}</span>
            {hasData && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: accuracy >= 80 ? '#DCFCE7' : accuracy >= 50 ? '#FEF3C7' : '#FEE2E2',
                color: accuracy >= 80 ? '#166534' : accuracy >= 50 ? '#92400E' : '#991B1B',
                fontWeight: 600, flexShrink: 0,
              }}>
                {accuracy}%
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{ width: 50, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, m * 100)}%`, height: '100%',
                background: MASTERY_COLORS[Math.min(5, Math.floor(m * 6))],
                borderRadius: 3, transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', minWidth: 30, textAlign: 'right' }}>
              {hasData ? `${totalC}/${totalP}` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 展开内容 ── */}
      {isExpanded && (
        <div style={{ padding: '6px 12px 10px', borderTop: `1px solid ${borderCard}`, fontSize: 12 }}>
          {detailLoading ? (
            <div style={{ color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>加载中...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* ═══ 1. 知识点精讲视频 ═══ */}
              <div>
                <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 4, fontSize: 12 }}>
                  📺 知识点精讲视频
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <input
                    value={videoInput}
                    onChange={e => setVideoInput(e.target.value)}
                    placeholder="粘贴视频链接（B站/YouTube等）"
                    style={{
                      flex: 1, minWidth: 160, padding: '5px 8px', border: '1px solid #D1D5DB',
                      borderRadius: 5, fontSize: 11, outline: 'none',
                      fontFamily: 'inherit',
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    {videoInput.trim() && (
                      <button onClick={() => window.open(videoInput.trim(), '_blank')}
                        style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: '#2563EB', color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        打开
                      </button>
                    )}
                    <button onClick={handleSaveVideo}
                      disabled={videoSaving || !videoInput.trim()}
                      style={{
                        padding: '5px 10px', borderRadius: 5, border: '1px solid #D1D5DB',
                        background: videoSaving ? '#F1F5F9' : '#fff', color: videoSaving ? '#94A3B8' : '#374151',
                        fontSize: 11, cursor: videoSaving || !videoInput.trim() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      }}>
                      {videoSaving ? '保存中...' : (detail?.video_url ? '更新' : '保存')}
                    </button>
                    <button onClick={() => window.open(`https://search.bilibili.com/all?keyword=${encodeURIComponent(node.point_name || '')}+数据结构+精讲`, '_blank')}
                      style={{ padding: '5px 10px', borderRadius: 5, border: '1px solid #D1D5DB', background: '#F0F9FF', color: '#0369A1', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                      🔍 B站搜索
                    </button>
                  </div>
                </div>
              </div>

              {/* ═══ 2. 专项练习 ═══ */}
              <div>
                <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 4, fontSize: 12 }}>
                  📝 专项练习
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#64748B', fontSize: 11 }}>
                    {hasData
                      ? `已练习 ${totalP} 次 · 正确 ${totalC} 题（${accuracy}%）`
                      : '暂无练习记录'}
                  </span>
                  <button onClick={e => { e.stopPropagation(); onPractice(node) }}
                    style={{
                      marginLeft: 'auto', padding: '5px 14px', borderRadius: 5, border: 'none',
                      background: '#2563EB', color: '#fff', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    }}>
                    开始练习 →
                  </button>
                </div>
              </div>

              {/* ═══ 3. 复习资料 ═══ */}
              <div>
                <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 4, fontSize: 12 }}>
                  📖 复习资料
                </div>
                {reviewContent ? (
                  <>
                    <div
                      onClick={e => { e.stopPropagation(); setReviewExpanded(!reviewExpanded) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                        fontSize: 11, color: '#6366F1', userSelect: 'none',
                      }}>
                      {reviewExpanded ? '收起 ▲' : '展开 ▼'} 查看 AI 生成的复习资料
                    </div>
                    {reviewExpanded && (
                      <div style={{
                        marginTop: 4, padding: '8px 10px', borderRadius: 6,
                        background: '#F8FAFC', border: '1px solid #E2E8F0',
                        fontSize: 11, color: '#374151', lineHeight: 1.7,
                        maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap',
                      }}>
                        {reviewContent}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); handleGenerateReview() }}
                      disabled={reviewGenerating}
                      style={{
                        padding: '5px 12px', borderRadius: 5, border: 'none',
                        background: reviewGenerating ? '#D1D5DB' : '#6366F1',
                        color: '#fff', fontSize: 11, fontWeight: 600,
                        cursor: reviewGenerating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      }}>
                      {reviewGenerating ? '⏳ 生成中...' : '🤖 AI 生成复习资料'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
