import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathApi } from '../api/path'
import { recommendApi, type Recommendation } from '../api/recommend'
import api from '../api/auth'
import MarkdownRenderer from '../components/MarkdownRenderer'
import { BookIcon, BotIcon, RocketIcon, TargetIcon, FlagIcon, EditIcon, FileIcon, VideoIcon, CheckIcon, CheckCircleIcon, RefreshIcon, ArrowRightIcon, ZapIcon } from '../components/Icons'
import { STATUS_LABELS } from '../constants/labels'

/* ── Icons ── */
function BackIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg> }

const MASTERY_COLORS = ['var(--app-danger)', '#F97316', 'var(--app-warning)', '#22C55E', 'var(--app-success)', 'var(--app-green-dark)']

export default function SubjectLearningPage() {
  const navigate = useNavigate()

  // ── Prevent duplicate recommendations loading ──
  const recsLoadedRef = useRef(false)

  // ── Subject & Goal ──
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [goalInput, setGoalInput] = useState('')
  const [goal, setGoal] = useState('')
  const [showSubjectPicker, setShowSubjectPicker] = useState(true)
  const [subjectLoading, setSubjectLoading] = useState(false)

  // ── Persist learning session across page visits ──
  useEffect(() => {
    const savedSubjectId = localStorage.getItem('learning_subject_id')
    const savedGoal = localStorage.getItem('learning_goal')
    if (savedSubjectId && savedGoal) {
      setSelectedSubject(savedSubjectId)
      setGoal(savedGoal)
      setGoalInput(savedGoal)
      setShowSubjectPicker(false)
    }
  }, [])

  const saveLearningSession = (subjectId: string, goalText: string) => {
    localStorage.setItem('learning_subject_id', subjectId)
    localStorage.setItem('learning_goal', goalText)
  }

  // ── Path & Diagnosis ──
  const [pathNodes, setPathNodes] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  
  const [pathLoading, setPathLoading] = useState(false)
  
  const [expandedNode, setExpandedNode] = useState<string | null>(null)

  // ── Chat-style diagnosis ──
  const [chatMessages, setChatMessages] = useState<Array<{role: string; text: string}>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // ── Load subjects ──
  const loadSubjects = useCallback(async () => {
    setSubjectLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch('/api/v1/question-bank/subjects', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      setSubjects(data.subjects || [])
    } catch { setSubjects([]) }
    finally { setSubjectLoading(false) }
  }, [])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  // ── Start learning: set goal + personalized AI diagnosis ──
  const handleStartLearning = async () => {
    if (!selectedSubject || !goalInput.trim()) return
    const subj = subjects.find(s => s.id === selectedSubject)
    setGoal(goalInput.trim())
    saveLearningSession(selectedSubject, goalInput.trim())
    setShowSubjectPicker(false)
    recsLoadedRef.current = false  // 重置加载标记
    setChatLoading(true)

    setChatMessages([{
      role: 'assistant',
      text: `📚 已设定科目「${subj?.name || ''}」，目标：${goalInput.trim()}\n\n🤖 正在根据你的目标生成个性化学习方案...`
    }])

    try {
      const res = await api.post('/chat/completions', {
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `你是一个智能学习规划专家。用户选择了科目「${subj?.name || ''}」，设定的学习目标是：${goalInput.trim()}。

请根据这个具体目标生成一份个性化的学习规划方案，格式如下：

## 🎯 目标分析
针对「${goalInput.trim()}」这个目标的具体分析。

## 📋 学习规划
按阶段列出学习内容，每个阶段包含：学习内容、建议时间、预期效果。

## 💡 学习建议
针对这个目标的具体学习方法和技巧。

## 📊 预期进度
如果按计划执行，预计什么时间可以达到什么水平。

注意：回答必须针对「${goalInput.trim()}」这个具体目标进行个性化分析，不能使用通用模板。用中文回答。`
          },
          { role: 'user', content: `我选择了「${subj?.name || ''}」，目标是「${goalInput.trim()}」，请给我一份个性化的学习规划方案。` },
        ],
        stream: false,
        temperature: 0.8,
        max_tokens: 2500,
      })

      const reply = res.data?.message?.content
      if (reply) {
        setChatMessages(prev => {
          const msgs = [...prev]
          msgs[0] = { role: 'assistant', text: reply }
          return msgs
        })
      }
    } catch {
      // AI 不可用时，用更丰富的固定引导（至少包含目标信息）
      setChatMessages([{
        role: 'assistant',
        text: `📚 已设定科目「${subj?.name || ''}」，目标：${goalInput.trim()}

为了为你制定个性化的学习计划，我需要先了解你的基础情况：

1. 你之前学过「${subj?.name || ''}」相关课程吗？
2. 你希望重点提升哪个方面的能力？
3. 你每周可以投入多少时间学习？

请回答以上问题，我会根据你的情况生成定制方案。`
      }])
    }
    setChatLoading(false)
    // Path & recs load automatically via useEffect when showSubjectPicker changes
  }

  // ── Chat diagnosis → then load path ──
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)

    try {
      // Build AI context + messages
      const systemPrompt = buildAIContext()
      const history = chatMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }))

      const res = await api.post('/chat/completions', {
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: msg },
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 2000,
      })

      const reply = res.data?.message?.content
      if (reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: reply }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: '✅ 已收到你的信息！请继续学习，系统会持续优化推荐。' }])
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || e?.message || ''
      if (errMsg.includes('API') || errMsg.includes('configured') || errMsg.includes('key')) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: '⚠️ AI服务暂未配置。请前往「API设置」页面配置AI密钥后再使用智能问答功能。' }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: '✅ 已收到你的信息！请继续输入或查看下方的学习路径。' }])
      }
    }
    setChatLoading(false)
  }

  const loadPathAndRecommendations = useCallback(async () => {
    if (recsLoadedRef.current) return  // 已经加载过，不再重复加载
    recsLoadedRef.current = true
    setPathLoading(true)
    try {
      // Build domain_name → subject mapping from loaded subjects
      const domainToSubject: Record<string, string> = {}
      for (const s of subjects) {
        for (const d of (s.domains || [])) {
          domainToSubject[d.name] = s.id
        }
      }

      const [pathRes, recRes] = await Promise.all([
        pathApi.getCurrentPath().catch(() => null),
        recommendApi.getAll({ subject_id: selectedSubject || undefined }).catch(() => null),
      ])

      if (pathRes?.data?.nodes) {
        const allNodes = pathRes.data.nodes.map((n: any) => ({
          ...n,
          mastery: typeof n.mastery_score === 'number' ? n.mastery_score / 100 : (n.mastery || 0)
        }))
        // Filter to only show current subject's nodes
        const nodes = allNodes.filter((n: any) => {
          const subjId = domainToSubject[n.domain_name]
          return subjId === selectedSubject
        })
        setPathNodes(nodes)

        // Find weak points
        const weak = nodes.filter((n: any) => (n.mastery || 0) < 0.6)
        const weakNames = weak.map((n: any) => n.point_name || n.name).slice(0, 3).join('、')

        // 仅在首次加载时添加诊断完成消息
        if (chatMessages.length <= 2) {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            text: `✅ 诊断完成！\n\n📊 **当前掌握概况**：共 ${nodes.length} 个知识点\n` +
              (weakNames ? `🔴 **薄弱环节**：${weakNames} 等 ${weak.length} 个知识点掌握度不足 60%\n` : '') +
              `系统已自动规划学习路径，请查看下方「学习路径」面板。`
          }])
        }
      } else if (chatMessages.length <= 2) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: '✅ 诊断完成！但目前暂无详细知识点数据。建议先做一些练习题，系统会逐步完善你的知识画像并规划路径。'
        }])
      }

      if (recRes?.data?.recommendations) {
        setRecommendations(recRes.data.recommendations.slice(0, 5))
      }
    } catch {
      if (chatMessages.length <= 2) {
        setChatMessages(prev => [...prev, {
          role: 'assistant', text: '诊断过程遇到一些问题，但已记录你的基础信息。请继续学习，系统会逐步优化推荐。'
        }])
      }
    }
    setPathLoading(false)
  }, [goal, subjects, selectedSubject, chatMessages.length])

  // ── Build AI context prompt from current state ──
  const buildAIContext = useCallback(() => {
    const subj = subjects.find(s => s.id === selectedSubject)
    const weak = pathNodes.filter((n: any) => (n.mastery || 0) < 0.6)
    const mastered = pathNodes.filter((n: any) => (n.mastery || 0) >= 0.8)
    const weakNames = weak.map((n: any) => n.point_name || n.name).join('、')
    return `你是一个智能学习规划助手，帮助用户制定个性化学习计划。

## 当前学习状态
- 科目：${subj?.name || '未选择'}
- 学习目标：${goal || '未设定'}
- 知识点总数：${pathNodes.length} 个

## 知识点掌握情况
- 已掌握（≥80%）：${mastered.length} 个
- 学习中（40%-80%）：${pathNodes.filter((n: any) => (n.mastery || 0) >= 0.4 && (n.mastery || 0) < 0.8).length} 个
- 薄弱（<40%）：${pathNodes.filter((n: any) => (n.mastery || 0) < 0.4).length} 个${weakNames ? '\n- 薄弱知识点：' + weakNames : ''}

## 你的职责
根据用户的问题，结合上述学习状态，提供具体、有针对性的学习建议。回答要详细、可操作，包括：推荐学习内容、学习方法、时间安排等。用中文回答。`
  }, [subjects, selectedSubject, goal, pathNodes])

  // ── Auto-load path when entering learning view ──
  useEffect(() => {
    if (!showSubjectPicker && subjects.length > 0) {
      loadPathAndRecommendations()
    }
  }, [showSubjectPicker, loadPathAndRecommendations, subjects])

  // ── Node click → show detail ──
  const toggleNode = (nodeId: string) => setExpandedNode(expandedNode === nodeId ? null : nodeId)

  // ── Mark node as studied ──
  const handleMarkStudy = async (pointId: string) => {
    try {
      await pathApi.recordKnowledgeStudy(pointId)
      setPathNodes(prev => prev.map(n =>
        (n.id === pointId || n.point_id === pointId) ? { ...n, mastery: Math.min(1, (n.mastery || 0) + 0.15) } : n
      ))
    } catch {}
  }

  // ── Ask AI to analyze goal ──
  const handleAskAIGoal = async () => {
    if (!selectedSubject || !goalInput.trim()) return
    const subj = subjects.find(s => s.id === selectedSubject)
    setGoal(goalInput.trim())
    saveLearningSession(selectedSubject, goalInput.trim())
    setShowSubjectPicker(false)
    recsLoadedRef.current = false  // 重置加载标记
    setChatLoading(true)

    setChatMessages([{
      role: 'assistant',
      text: `📚 已设定科目「${subj?.name || ''}」，目标：${goalInput.trim()}\n\n🤔 正在分析你的目标并生成个性化学习建议...`
    }])

    try {
      const res = await api.post('/chat/completions', {
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: `你是一个智能学习规划专家。用户选择了科目「${subj?.name || ''}」，设定的学习目标是：${goalInput.trim()}。

请从以下几个方面提供详细的分析和建议：
1. **目标分析**：这个目标是否具体可行？是否需要调整？
2. **学习重点**：针对这个目标，应该重点关注哪些知识领域？
3. **学习方法**：推荐适合的学习策略和时间安排
4. **预期路径**：大致的学习阶段和里程碑

回答要具体、个性化，不要通用模板。用中文回答。` },
          { role: 'user', content: `请帮我分析「${subj?.name || ''}」的学习目标「${goalInput.trim()}」，给出个性化的学习建议。` },
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 2000,
      })

      const reply = res.data?.message?.content
      if (reply) {
        setChatMessages(prev => {
          const msgs = [...prev]
          msgs[msgs.length - 1] = { role: 'assistant', text: reply }
          return msgs
        })
      }
    } catch {
      // AI unavailable — still proceed with path loading
      setChatMessages(prev => [...prev, {
        role: 'assistant', text: `📚 已设定科目「${subj?.name || ''}」，目标：${goalInput.trim()}\n\n正在诊断你的知识基础，请回答几个问题来了解你的掌握情况…`
      }, {
        role: 'assistant', text: `在学习「${subj?.name || ''}」之前，你之前有接触过相关知识吗？请简单描述你的基础。`
      }])
    }
    setChatLoading(false)
    // Path & recs load automatically via useEffect when showSubjectPicker changes
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg-card-alt)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--app-text-secondary)' }}><BackIcon/></button>
        <span style={{ fontWeight: 600, fontSize: 16 }}>
          {showSubjectPicker ? '设定学习目标' : <><TargetIcon size={16} /> {subjects.find(s => s.id === selectedSubject)?.name || ''} 学习路径</>}
        </span>
        {!showSubjectPicker && goal && (
          <span style={{ fontSize: 13, color: 'var(--app-text-secondary)', marginLeft: 8 }}>
            目标：{goal}
          </span>
        )}
        {!showSubjectPicker && (
          <button onClick={() => { setShowSubjectPicker(true); setChatMessages([]); setPathNodes([]); }}
            style={{ marginLeft: 'auto', padding: '4px 12px', border: '1px solid #D1D5DB', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: 'var(--app-text-secondary)' }}>
            <EditIcon size={12} /> 修改目标
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left: Path Board ── */}
        <div style={{ width: '45%', minWidth: 340, display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB', background: '#fff' }}>
          {/* Goal Progress */}
          {!showSubjectPicker && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-brand)' }}>目标进度</span>
                <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>
                  预估达成：<strong style={{ color: (0 || 0) >= 80 ? 'var(--app-green-dark)' : 'var(--app-danger-dark)' }}>{0}分</strong>
                </span>
              </div>
              <div style={{ height: 6, background: '#CBD5E1', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (0 || 0))}%`, background: (0 || 0) >= 80 ? 'var(--app-green-dark)' : 'var(--app-danger-dark)', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )}

          {/* Subject Picker */}
          {showSubjectPicker ? (
            <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}><BookIcon size={18} /> 选择你要学习的科目</h2>
              <p style={{ fontSize: 14, color: 'var(--app-text-secondary)', marginBottom: 20 }}>设定目标后，系统将自动诊断并规划学习路径</p>
              {subjectLoading ? <p style={{ color: 'var(--app-text-muted)' }}>加载中...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {subjects.filter(s => s.name && s.domains?.length > 0).map(s => (
                    <div key={s.id} onClick={() => setSelectedSubject(s.id)}
                      style={{ padding: '14px 16px', border: `2px solid ${selectedSubject === s.id ? 'var(--app-info)' : 'var(--app-border)'}`, borderRadius: 12, cursor: 'pointer', background: selectedSubject === s.id ? '#EFF6FF' : '#fff', transition: 'all 0.15s' }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                      {s.description && <div style={{ fontSize: 12, color: 'var(--app-text-muted)', marginTop: 2 }}>{s.description}</div>}
                      <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>{s.domains?.length || 0} 个知识领域</div>
                    </div>
                  ))}
                </div>
              )}
              <input value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="输入学习目标，如：期末考试成绩达到90分" style={{ width: '100%', padding: '12px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, outline: 'none', marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleAskAIGoal} disabled={!selectedSubject || !goalInput.trim()}
                  style={{ flex: 1, padding: '12px', background: !selectedSubject || !goalInput.trim() ? 'var(--app-text-placeholder)' : 'var(--app-purple)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: !selectedSubject || !goalInput.trim() ? 'not-allowed' : 'pointer' }}>
                  <BotIcon size={14} /> 提问AI — 分析目标
                </button>
                <button onClick={handleStartLearning} disabled={!selectedSubject || !goalInput.trim()}
                  style={{ flex: 1, padding: '12px', background: !selectedSubject || !goalInput.trim() ? 'var(--app-text-placeholder)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: !selectedSubject || !goalInput.trim() ? 'not-allowed' : 'pointer' }}>
                  <RocketIcon size={15} /> 开始学习
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Path Nodes */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {pathLoading ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--app-text-muted)' }}>正在生成学习路径...</div>
                ) : pathNodes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--app-text-muted)' }}>暂无学习路径数据，先做一些练习吧</div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: 24 }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: 11, top: 8, bottom: 8, width: 2, background: 'var(--app-border)' }} />
                    {pathNodes.filter((n: any) => n.domain_name).reduce((acc: any[], n: any) => {
                      const last = acc[acc.length - 1]
                      if (last?.domain === n.domain_name) { last.nodes.push(n); return acc }
                      acc.push({ domain: n.domain_name, nodes: [n] }); return acc
                    }, [] as any[]).map((group: any, gi: number) => (
                      <div key={gi}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-secondary)', padding: '8px 0 4px', marginTop: gi > 0 ? 8 : 0 }}>{group.domain}</div>
                        {group.nodes.map((node: any) => {
                          const m = node.mastery || 0
                          const isActive = m < 0.8 && (group.nodes[0] === node || (group.nodes[group.nodes.indexOf(node) - 1]?.mastery || 0) >= 0.8)
                          const isExpanded = expandedNode === (node.id || node.point_id)
                          return (
                            <div key={node.id || node.point_id} style={{ position: 'relative', marginBottom: 4 }}>
                              {/* Dot */}
                              <div style={{ position: 'absolute', left: -17, top: 12, width: 10, height: 10, borderRadius: '50%', background: m >= 0.8 ? '#22C55E' : isActive ? 'var(--app-info)' : 'var(--app-text-placeholder)', border: '2px solid #fff', boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none' }} />
                              {/* Node Card */}
                              <div onClick={() => toggleNode(node.id || node.point_id)} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isActive ? '#BFDBFE' : 'var(--app-bg-page)'}`, background: isActive ? '#EFF6FF' : '#FAFAFA', transition: 'all 0.15s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--app-text-heading)' }}>{node.point_name || node.name}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ width: 36, height: 4, background: 'var(--app-border)', borderRadius: 2, overflow: 'hidden' }}>
                                      <div style={{ width: `${m * 100}%`, height: '100%', background: MASTERY_COLORS[Math.min(5, Math.floor(m * 6))], borderRadius: 2, transition: 'width 0.5s ease' }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--app-text-muted)', minWidth: 32, textAlign: 'right' }}>{Math.round(m * 100)}%</span>
                                  </div>
                                </div>
                                {isExpanded && (
                                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E5E7EB', fontSize: 12 }}>
                                    <div style={{ color: 'var(--app-text-secondary)', marginBottom: 6 }}>状态：{STATUS_LABELS[node.status] || '未开始'} ｜ 难度：{node.difficulty || 1}/5</div>
                                    <button onClick={(e) => { e.stopPropagation(); handleMarkStudy(node.point_id || node.id) }}
                                      style={{ padding: '4px 12px', background: 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                                      <CheckIcon size={12} /> 标记已学习
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Chat Diagnosis + Resources ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--app-bg-card-alt)' }}>
          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {showSubjectPicker ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--app-text-muted)' }}>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><TargetIcon size={48} /></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-text-secondary)' }}>选择科目并设定目标</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>系统将自动诊断并为你规划学习路径</div>
              </div>
            ) : (
              <>
                {chatMessages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--app-text-muted)' }}>
                    <div style={{ fontSize: 14 }}>正在初始化诊断...</div>
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.role === 'user' ? (
                      <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, background: 'var(--app-info)', color: '#fff', whiteSpace: 'pre-wrap' }}>
                        {m.text.split('\n').map((line, j) => <div key={j}>{line}</div>)}
                      </div>
                    ) : (
                      <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 12, background: '#fff', border: '1px solid #E5E7EB', fontSize: 14, lineHeight: 1.7 }}>
                        <MarkdownRenderer content={m.text} />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            )}

            {/* Resource recommendations */}
            {recommendations.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text-secondary)', marginBottom: 8 }}><FlagIcon size={12} /> 系统推荐</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recommendations.map((rec, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{rec.reason || rec.type}</span>
                        <span style={{ fontSize: 11, color: 'var(--app-text-muted)' }}>{rec.resources?.length || 0} 个资源</span>
                      </div>
                      {rec.resources?.slice(0, 3).map((r: any, j: number) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: 'var(--app-text-secondary)' }}>
                          <span>{r.type === 'video' ? <VideoIcon size={12} /> : r.type === 'doc' ? <FileIcon size={12} /> : <EditIcon size={12} />}</span>
                          <span>{r.title || r.name}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          {!showSubjectPicker && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #E5E7EB', background: '#fff' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                  placeholder="描述你的学习情况，或问：我当前最该学什么？" style={{ flex: 1, padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none' }} disabled={chatLoading} />
                <button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()}
                  style={{ padding: '10px 18px', background: chatLoading || !chatInput.trim() ? 'var(--app-text-placeholder)' : 'var(--app-info)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer' }}>
                  {chatLoading ? '诊断中...' : '发送'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {[
                  { label: '我当前最该学什么？', icon: <TargetIcon size={11} /> },
                  { label: '这个知识点掌握了吗？', icon: <CheckCircleIcon size={11} /> },
                  { label: '给我推荐练习题', icon: <EditIcon size={11} /> },
                  { label: '调整学习路径', icon: <RefreshIcon size={11} /> },
                  { label: '跳过已掌握章节', icon: <ArrowRightIcon size={11} /> },
                  { label: '我想多练薄弱点', icon: <ZapIcon size={11} /> },
                ].map(({ label, icon }) => (
                  <button key={label} onClick={() => { setChatInput(label) }}
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
