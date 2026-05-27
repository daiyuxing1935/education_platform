import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { profileV2Api, dashboardApi } from '../api'
import { pathApi, type AgentRecommendation } from '../api/path'
import { recommendApi, type Recommendation } from '../api/recommend'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircleIcon, EditIcon, BotIcon, ZapIcon, LightbulbIcon, AlertTriangleIcon, BookIcon, UserIcon } from '../components/Icons'

/* ── Simple SVG Icons for Nav (inline to avoid dependency) ── */

function CompassIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )
}

function UserCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <polyline points="17 11 19 13 23 9"/>
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

function FireIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 23c5.523 0 10-4.477 10-10 0-4.478-2.078-7.742-4.164-10.084C16.394 1.328 14.373 0 12 0 9.627 0 7.606 1.328 6.164 2.916 4.078 5.258 2 8.522 2 13c0 5.523 4.477 10 10 10z"/>
      <path d="M12 21a1 1 0 0 0 1-1c0-2-1.5-3.5-2.5-4.5S9 14 9 12c0-1 1-2 3-2-1 1.5-.5 3 .5 4.5S15 17 15 19a3 3 0 0 1-3 3z" fill="white"/>
    </svg>
  )
}

const featureCards = [
  { title: '智能画像', desc: '通过练习和对话自动构建多维学习画像，精准把握学习特点', icon: <UserIcon size={18} />, to: '/profile/dynamic' },
  { title: '个性化资源', desc: 'AI生成定制化学习资料，因材施教提升学习效率', icon: <BookIcon size={18} />, to: '/resources' },
  { title: '智能路径', desc: '科学规划学习路径，可视化知识图谱动态调整计划', icon: <CompassIcon />, to: '/path' },
  { title: '多模态答疑', desc: '即时答疑解惑，多种形式解答助力理解', icon: <BotIcon size={18} />, to: '/chat/new' },
]

export default function HomePage() {
  const { isAuthenticated, user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [hasProfile, setHasProfile] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [recommendations, setRecommendations] = useState<AgentRecommendation[]>([])
  const [personRecs, setPersonRecs] = useState<Recommendation[]>([])
  const [studyStats, setStudyStats] = useState({ total_study_days: 0, current_streak: 0, longest_streak: 0, today_questions: 0, today_minutes: 0 })

  useEffect(() => {
    if (isAuthenticated) {
      checkProfile()
      loadDashboard()
    } else {
      setIsChecking(false)
    }
  }, [isAuthenticated])

  const checkProfile = async () => {
    try {
      await profileV2Api.getProfile()
      setHasProfile(true)
    } catch {
      setHasProfile(false)
    } finally {
      setIsChecking(false)
    }
  }

  const loadDashboard = useCallback(async () => {
    try {
      const [pathRes, agentRes, recRes, statsRes] = await Promise.allSettled([
        pathApi.getCurrentPath(),
        pathApi.getAgentRecommendations(),
        recommendApi.getAll(),
        dashboardApi.getStats(),
      ])
      if (pathRes.status === 'fulfilled') setSummary(pathRes.value.data.summary)
      if (agentRes.status === 'fulfilled') setRecommendations(agentRes.value.data.recommendations.slice(0, 3))
      if (recRes.status === 'fulfilled') setPersonRecs(recRes.value.data.recommendations.slice(0, 3))
      if (statsRes.status === 'fulfilled') setStudyStats(statsRes.value.data)
    } catch {
      // silent
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const todayRecs = recommendations.filter(r => r.priority === 'high').slice(0, 4)
  const totalMastered = summary.mastered || 0
  const totalLearning = summary.learning || 0
  const totalPoints = summary.total || 0
  const totalDifficult = summary.difficult || 0

  return (
    <div className="fade-in" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ─── Navigation ─── */}
      <nav style={{
        backgroundColor: '#FFFFFFCC',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #EDE9E3',
        padding: '0 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '64px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link to="/" style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: '#4F46E5',
            letterSpacing: '-0.02em',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5"/>
            </svg>
            Education Agent
          </Link>
        </div>

        {isAuthenticated && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Username */}
            <span style={{ color: '#9CA3AF', fontSize: '0.8125rem', fontWeight: 500, marginRight: '4px' }}>
              {user?.username}
            </span>

            {/* ── 开始学习 Dropdown ── */}
            <div className="nav-dropdown-wrapper">
              <button className="nav-dropdown-trigger">
                <CompassIcon />
                开始学习
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div className="nav-dropdown-menu">
                <Link to="/path" className="nav-dropdown-item">
                  <span className="nav-dropdown-item-icon"><CompassIcon /></span>
                  学习路径
                </Link>
                <Link to="/resources" className="nav-dropdown-item">
                  <span className="nav-dropdown-item-icon"><BookOpenIcon /></span>
                  学习资源
                </Link>
                <Link to="/banks" className="nav-dropdown-item">
                  <span className="nav-dropdown-item-icon"><LayersIcon /></span>
                  题库
                </Link>
              </div>
            </div>

            {/* ── 个人中心 Dropdown ── */}
            <div className="nav-dropdown-wrapper">
              <button className="nav-dropdown-trigger">
                <div className="nav-avatar" style={{ overflow: 'hidden' }}>
                  {user?.profile?.avatar_url ? (
                    <img src={user.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.username?.charAt(0)?.toUpperCase() || 'U'
                  )}
                </div>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <div className="nav-dropdown-menu" style={{ minWidth: '200px' }}>
                <Link to="/profile" className="nav-dropdown-item">
                  <span className="nav-dropdown-item-icon"><UserCheckIcon /></span>
                  个人资料
                </Link>
                <Link to="/profile/dynamic" className="nav-dropdown-item">
                  <span className="nav-dropdown-item-icon"><UserIcon size={16} /></span>
                  动态画像
                </Link>
                <Link to="/settings/api" className="nav-dropdown-item">
                  <span className="nav-dropdown-item-icon"><SettingsIcon /></span>
                  API 设置
                </Link>
                {user?.role === 'admin' && (
                  <Link to="/admin" className="nav-dropdown-item">
                    <span className="nav-dropdown-item-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                      </svg>
                    </span>
                    管理后台
                  </Link>
                )}
                <button onClick={handleLogout} className="nav-dropdown-item nav-dropdown-item-danger">
                  <span className="nav-dropdown-item-icon"><LogoutIcon /></span>
                  退出账号
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', opacity: 0.6 }}>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {!isAuthenticated ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Hero — unauthenticated */}
          <div className="card" style={{
            textAlign: 'center', padding: 'var(--space-12) var(--space-6)', border: 'none',
            background: `linear-gradient(135deg, oklch(0.55 0.25 250), oklch(0.45 0.20 270))`,
            color: 'white', boxShadow: 'var(--shadow-lg)',
          }}>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', marginBottom: 'var(--space-3)', fontWeight: 700, letterSpacing: '-0.03em' }}>
              Education Agent
            </h1>
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', opacity: 0.9, marginBottom: 'var(--space-8)', maxWidth: 480, margin: '0 auto var(--space-8)' }}>
              基于大模型的个性化资源生成与学习多智能体系统
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" className="btn" style={{ padding: 'var(--space-3) var(--space-6)', backgroundColor: 'white', color: 'var(--primary)', fontWeight: 600, borderRadius: 'var(--radius-lg)' }}>
                立即开始
              </Link>
              <Link to="/login" className="btn" style={{ padding: 'var(--space-3) var(--space-6)', backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 'var(--radius-lg)' }}>
                登录账号
              </Link>
            </div>
          </div>

          {/* Features — unauthenticated */}
          <section style={{ marginTop: 'var(--space-10)' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-6)', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              核心功能
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
              {featureCards.map((feature, i) => (
                <Link key={feature.title} to={feature.to} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card slide-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                    <div style={{ color: 'var(--primary)', marginBottom: 'var(--space-3)' }}>{feature.icon}</div>
                    <h3 style={{ fontSize: '1.125rem', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-heading)' }}>{feature.title}</h3>
                    <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', lineHeight: 1.6 }}>{feature.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* ─── Authenticated Dashboard ─── */
        <div style={{ flex: 1, overflow: 'hidden', padding: '24px 32px 32px', display: 'flex', flexDirection: 'column' }}>
          {/* Welcome Banner */}
          <div className="welcome-banner" style={{
            borderRadius: '16px', padding: '20px 28px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                欢迎回来，{user?.username}
                <span className="welcome-banner-accent">
                  <FireIcon /> 连续学习 {studyStats.current_streak} 天
                </span>
              </h2>
              <p style={{ color: '#6B7280', fontSize: '0.875rem', margin: 0 }}>
                今日已完成 {studyStats.today_questions} 题，学习 {studyStats.today_minutes} 分钟 ·
                {totalDifficult > 0 && <span style={{ color: '#EF4444' }}> {totalDifficult} 个薄弱点待攻克</span>}
                {totalDifficult === 0 && <span style={{ color: '#10B981' }}> 继续保持！</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/chat/new" className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '10px' }}>AI 对话</Link>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '16px', flexShrink: 0,
          }}>
            {[
              { label: '总掌握度', value: totalPoints > 0 ? `${Math.round((totalMastered / totalPoints) * 100)}%` : '--', sub: `${totalMastered} 已掌握 / ${totalPoints} 总计`, color: '#10B981', bg: '#F0FDF4', icon: <CheckCircleIcon size={20} color="#10B981" /> },
              { label: '练习总题数', value: String(summary.total || '--'), sub: '累计练习题目数', color: '#6366F1', bg: '#EEF2FF', icon: <EditIcon size={20} color="#6366F1" /> },
              { label: '知识点', value: String(totalPoints), sub: `${totalLearning} 个学习中`, color: '#F59E0B', bg: '#FFFBEB', icon: <BookIcon size={20} /> },
              { label: '学习天数', value: String(studyStats.total_study_days), sub: `最长 ${studyStats.longest_streak} 天`, color: '#EC4899', bg: '#FDF2F8', icon: <FireIcon /> },
            ].map((stat, i) => (
              <div key={i} className="dashboard-card" style={{
                padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px',
                background: stat.bg,
              }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {stat.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: stat.color, lineHeight: 1.1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>{stat.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content — 2 columns, fills remaining space */}
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
            {/* Left: Recommendations */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="dashboard-card" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexShrink: 0 }}>
                  <BotIcon size={18} color="#6366F1" />
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: '#1F2937' }}>今日建议</h3>
                  <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', background: '#F3F4F6', padding: '2px 8px', borderRadius: '8px' }}>
                    {todayRecs.length + personRecs.length} 项
                  </span>
                </div>
                {todayRecs.length === 0 && personRecs.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D1D5DB', fontSize: '0.8125rem' }}>
                    暂无建议，开始练习吧
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'auto' }}>
                    {todayRecs.map((rec, i) => (
                      <Link key={`agent-${i}`} to="/path" style={{
                        textDecoration: 'none', color: 'inherit',
                        padding: '12px 14px', borderRadius: '10px',
                        background: rec.priority === 'high' ? '#FEF2F2' : '#F9FAFB',
                        border: `1px solid ${rec.priority === 'high' ? '#FECACA' : '#E5E7EB'}`,
                        borderLeft: `3px solid ${rec.priority === 'high' ? '#EF4444' : '#6366F1'}`,
                        transition: 'transform 0.15s', flexShrink: 0,
                      }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', marginBottom: '2px' }}>
                          {rec.title}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#6B7280', lineHeight: 1.4 }}>
                          {rec.description}
                        </div>
                      </Link>
                    ))}
                    {personRecs.slice(0, 2).map((rec, i) => (
                      <Link key={`person-${i}`} to="/path" style={{
                        textDecoration: 'none', color: 'inherit',
                        padding: '12px 14px', borderRadius: '10px',
                        background: '#FAF5FF', border: '1px solid #E9D5FF',
                        borderLeft: '3px solid #8B5CF6',
                        transition: 'transform 0.15s', flexShrink: 0,
                      }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', marginBottom: '2px' }}>
                          {rec.title}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#6B7280', lineHeight: 1.4 }}>
                          {rec.reason}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Start + Tips */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="dashboard-card" style={{ padding: '20px', flex: 1, marginBottom: '14px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 14px', color: '#1F2937', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <ZapIcon size={16} color="#6366F1" /> 快速开始
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: 1 }}>
                  {[
                    { label: '开始练习', desc: '从题库中选择题目练习', to: '/banks', color: '#6366F1', bg: '#EEF2FF' },
                    { label: 'AI 对话', desc: '与 AI 讨论学习问题', to: '/chat/new', color: '#8B5CF6', bg: '#F5F3FF' },
                    { label: '学习规划', desc: '设定目标，系统自动规划', to: '/subject-learning', color: '#3B82F6', bg: '#EFF6FF' },
                    { label: '查看画像', desc: '深入了解学习状态', to: '/profile/dynamic', color: '#F59E0B', bg: '#FFFBEB' },
                  ].map((action, i) => (
                    <Link key={i} to={action.to} className="quick-start-card" style={{
                      padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                      background: action.bg, border: `1px solid ${action.color}33`,
                    }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: action.color, marginBottom: '2px' }}>
                        {action.label}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>
                        {action.desc}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Learning tips */}
              <div className="dashboard-card" style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #FFFBEB, #FFF7ED)', flexShrink: 0 }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 8px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <LightbulbIcon size={14} color="#D97706" /> 学习小贴士
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#92400E', lineHeight: 1.5, opacity: 0.8 }}>
                  艾宾浩斯遗忘曲线提示：学完新知识后，在 1 天、2 天、4 天、7 天后分别复习一次，能有效提升长期记忆效果。
                  {totalDifficult > 0 && (
                    <span style={{ display: 'block', marginTop: '6px', fontWeight: 600, opacity: 1 }}>
                      <AlertTriangleIcon size={12} color="#EF4444" /> 你有 {totalDifficult} 个薄弱知识点，建议优先攻克。
                    </span>
                  )}
                </div>
              </div>

              {!isChecking && !hasProfile && (
                <div className="dashboard-card" style={{ padding: '14px 20px', background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', textAlign: 'center', border: '1px solid rgba(99,102,241,0.15)', marginTop: '14px', flexShrink: 0 }}>
                  <p style={{ fontSize: '0.8125rem', color: '#4F46E5', margin: '0 0 10px' }}>
                    初始化你的学习画像，获得更精准的学习建议
                  </p>
                  <Link to="/profile/init" className="btn btn-primary" style={{ padding: '6px 18px', borderRadius: '10px', fontSize: '0.8125rem' }}>
                    初始化画像
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
