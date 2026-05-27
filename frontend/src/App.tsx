import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuthStore } from './store/auth'
import Layout from './components/Layout'

// Eagerly loaded (always needed)
// Layout, ProtectedRoute

// Lazy-loaded page components
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ProfileInitPage = lazy(() => import('./pages/ProfileInitPage'))
const DynamicProfilePage = lazy(() => import('./pages/DynamicProfilePage'))
const BehaviorEventsPage = lazy(() => import('./pages/BehaviorEventsPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ChatPlatform = lazy(() => import('./components/ChatPlatform'))
const BankListPage = lazy(() => import('./pages/BankListPage'))
const BankDetailPage = lazy(() => import('./pages/BankDetailPage'))
const PracticePage = lazy(() => import('./pages/PracticePage'))
const ExamPaperDetailPage = lazy(() => import('./pages/ExamPaperDetailPage'))
const ApiSettingsPage = lazy(() => import('./pages/ApiSettingsPage'))
const LearningPathPage = lazy(() => import('./pages/LearningPathPage'))
const SubjectLearningPage = lazy(() => import('./pages/SubjectLearningPage'))
const PathHistoryPage = lazy(() => import('./pages/PathHistoryPage'))
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'))
const ResourceDetailPage = lazy(() => import('./pages/ResourceDetailPage'))
const CloudDrivePage = lazy(() => import('./pages/CloudDrivePage'))
const WrongAnswerPage = lazy(() => import('./pages/WrongAnswerPage'))
const TestHistoryPage = lazy(() => import('./pages/TestHistoryPage'))
const TestHistoryDetailPage = lazy(() => import('./pages/TestHistoryDetailPage'))
const DailyStatsPage = lazy(() => import('./pages/DailyStatsPage'))

const PageFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: '14px' }}>
    加载中...
  </div>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LazyRoute><HomePage /></LazyRoute>} />
          <Route path="login" element={<LazyRoute><LoginPage /></LazyRoute>} />
          <Route path="register" element={<LazyRoute><RegisterPage /></LazyRoute>} />
          <Route path="chat" element={<ProtectedRoute><LazyRoute><ChatPage /></LazyRoute></ProtectedRoute>} />
          <Route path="chat/new" element={<ProtectedRoute><LazyRoute><ChatPlatform /></LazyRoute></ProtectedRoute>} />
          <Route path="profile/init" element={<ProtectedRoute><LazyRoute><ProfileInitPage /></LazyRoute></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><LazyRoute><ProfilePage /></LazyRoute></ProtectedRoute>} />
          <Route path="profile/dynamic" element={<ProtectedRoute><LazyRoute><DynamicProfilePage /></LazyRoute></ProtectedRoute>} />
          <Route path="profile/events" element={<ProtectedRoute><LazyRoute><BehaviorEventsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks" element={<ProtectedRoute><LazyRoute><BankListPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId" element={<ProtectedRoute><LazyRoute><BankDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/practice" element={<ProtectedRoute><LazyRoute><PracticePage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/exam-papers/:paperId" element={<ProtectedRoute><LazyRoute><ExamPaperDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/history" element={<ProtectedRoute><LazyRoute><TestHistoryPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/history/:sessionId" element={<ProtectedRoute><LazyRoute><TestHistoryDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/wrong-answers" element={<ProtectedRoute><LazyRoute><WrongAnswerPage /></LazyRoute></ProtectedRoute>} />
          <Route path="banks/:bankId/stats" element={<ProtectedRoute><LazyRoute><DailyStatsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="wrong-answers" element={<ProtectedRoute><LazyRoute><WrongAnswerPage /></LazyRoute></ProtectedRoute>} />
          <Route path="stats" element={<ProtectedRoute><LazyRoute><DailyStatsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute><LazyRoute><AdminPage /></LazyRoute></ProtectedRoute>} />
          <Route path="projects" element={<Navigate to="/chat/new" replace />} />
          <Route path="api-settings" element={<Navigate to="/settings/api" replace />} />
          <Route path="settings/api" element={<ProtectedRoute><LazyRoute><ApiSettingsPage /></LazyRoute></ProtectedRoute>} />
          <Route path="path" element={<ProtectedRoute><LazyRoute><LearningPathPage /></LazyRoute></ProtectedRoute>} />
          <Route path="subject-learning" element={<ProtectedRoute><LazyRoute><SubjectLearningPage /></LazyRoute></ProtectedRoute>} />
          <Route path="path/history" element={<ProtectedRoute><LazyRoute><PathHistoryPage /></LazyRoute></ProtectedRoute>} />
          <Route path="resources" element={<ProtectedRoute><LazyRoute><ResourcesPage /></LazyRoute></ProtectedRoute>} />
          <Route path="resources/:id" element={<ProtectedRoute><LazyRoute><ResourceDetailPage /></LazyRoute></ProtectedRoute>} />
          <Route path="cloud-drive" element={<ProtectedRoute><LazyRoute><CloudDrivePage /></LazyRoute></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
