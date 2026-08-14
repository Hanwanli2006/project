import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import remarkDisplayInlineMath from '../remark-display-inline-math.js'
import 'katex/dist/katex.min.css'
import '../Teacher.css'

/* ── 与学生端一致的 markdown 渲染 ────────────────────── */
const normalizeDelimiters = (text) =>
  text
    .replace(/\\\[/g, '$$$$').replace(/\\\]/g, '$$$$')
    .replace(/\\\(/g, '$').replace(/\\\)/g, '$')

function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkDisplayInlineMath]}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
    >
      {normalizeDelimiters(content)}
    </ReactMarkdown>
  )
}

/* ── 学生列表组件 ────────────────────────────── */
function StudentList({ onSelect, subject }) {
  const [students, setStudents] = useState(null)

  useEffect(() => {
    setStudents(null)
    const url = subject
      ? `/api/teacher/students?subject=${encodeURIComponent(subject)}`
      : '/api/teacher/students'
    fetch(url).then(r => r.json()).then(setStudents).catch(() => setStudents([]))
  }, [subject])

  if (students === null) return <div className="teacher-loading">加载中…</div>
  if (students.length === 0) return <div className="question-empty">暂无学生提问记录</div>

  return (
    <div className="student-list">
      {students.map(s => (
        <div key={s.studentId} className="student-card" onClick={() => onSelect(s.studentId)}>
          <div className="student-card__info">
            <span className="student-card__id">{s.studentId}</span>
            <span className="student-card__meta">
              {s.lastActive ? `最近提问：${new Date(s.lastActive).toLocaleString('zh-CN')}` : '暂无提问'}
            </span>
          </div>
          <span className="student-card__count">{s.questionCount} 个问题</span>
        </div>
      ))}
    </div>
  )
}

/* ── 学生问题详情 ────────────────────────────── */
function StudentDetail({ studentId, onBack, subject }) {
  const [questions, setQuestions] = useState(null)
  useEffect(() => {
    setQuestions(null)
    const url = subject
      ? `/api/teacher/questions/${studentId}?subject=${encodeURIComponent(subject)}`
      : `/api/teacher/questions/${studentId}`
    fetch(url).then(r => r.json()).then(setQuestions).catch(() => setQuestions([]))
  }, [studentId, subject])

  return (
    <div className="question-detail">
      <button className="question-detail__back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        返回学生列表
      </button>
      <h2 className="teacher-main__title">学生 {studentId} 的提问</h2>
      {questions === null ? (
        <div className="teacher-loading">加载中…</div>
      ) : questions.length === 0 ? (
        <div className="question-empty">该学生暂无提问记录</div>
      ) : (
        questions.slice().reverse().map(q => (
          <div key={q.id} className="question-item">
            <div className="question-item__q">
              <div className="question-item__label">问题</div>
              <div className="question-item__text">{q.question}</div>
            </div>
            {q.answer && (
              <div className="question-item__a">
                <div className="question-item__label">AI 回答</div>
                <div className="question-item__answer"><MarkdownContent content={q.answer} /></div>
              </div>
            )}
            <div className="question-item__time">{new Date(q.timestamp).toLocaleString('zh-CN')}</div>
          </div>
        ))
      )}
    </div>
  )
}

/* ── 知识库管理 ──────────────────────────────── */
function KnowledgeManager() {
  const [entries, setEntries] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('')
  const [content, setContent] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null) // null | 'success' | 'error'

  const load = useCallback(() => {
    fetch('/api/teacher/knowledge').then(r => r.json()).then(setEntries).catch(() => setEntries([]))
  }, [])
  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/teacher/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), course: course.trim() || '通用' }),
      })
      setTitle(''); setCourse(''); setContent(''); setShowForm(false)
      load()
    } catch (err) { alert('添加失败：' + err.message) } finally { setSubmitting(false) }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    setUploadStatus(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', title || file.name.replace(/\.[^.]+$/, ''))
      formData.append('course', course || '通用')
      const res = await fetch('/api/teacher/knowledge/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '上传失败')
      }
      setTitle(''); setCourse(''); setContent(''); setShowForm(false)
      setUploadStatus('success')
      load()
    } catch (err) { setUploadStatus('error'); alert('文件上传失败：' + err.message) } finally { setUploading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条知识吗？')) return
    try { await fetch(`/api/teacher/knowledge/${id}`, { method: 'DELETE' }); load() } catch (err) { alert('删除失败：' + err.message) }
  }

  return (
    <div>
      <div className="knowledge-header">
        <h2 className="teacher-main__title" style={{ marginBottom: 0 }}>知识库管理</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="knowledge-add-btn" style={{ cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            {uploading ? '解析压缩中…' : '上传文件'}
            <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileUpload} hidden disabled={uploading} />
          </label>
          <button className="knowledge-add-btn" onClick={() => setShowForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            手动添加
          </button>
        </div>
      </div>
      {uploadStatus && (
        <div className={`knowledge-upload-status knowledge-upload-status--${uploadStatus}`}>
          {uploadStatus === 'success' ? '上传成功，已解析入库' : '上传失败，请重试'}
        </div>
      )}
      {showForm && (
        <form className="knowledge-form" onSubmit={handleSubmit}>
          <div className="knowledge-form__group">
            <label className="knowledge-form__label">标题</label>
            <input className="knowledge-form__input" placeholder="如：高数-极限运算法则" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="knowledge-form__group">
            <label className="knowledge-form__label">课程</label>
            <input className="knowledge-form__input" placeholder="如：高等数学（留空则为通用）" value={course} onChange={e => setCourse(e.target.value)} />
          </div>
          <div className="knowledge-form__group">
            <label className="knowledge-form__label">内容</label>
            <textarea className="knowledge-form__textarea" placeholder="输入知识点内容、公式、例题等… 也可以直接上传 PDF/Word/PPT 文件" value={content} onChange={e => setContent(e.target.value)} required />
          </div>
          <div className="knowledge-form__actions">
            <button type="button" className="knowledge-form__cancel" onClick={() => setShowForm(false)}>取消</button>
            <button type="submit" className="knowledge-form__submit" disabled={submitting}>{submitting ? '提交中…' : '保存'}</button>
          </div>
        </form>
      )}
      {entries === null ? (
        <div className="teacher-loading">加载中…</div>
      ) : entries.length === 0 ? (
        <div className="knowledge-empty">还没有知识库内容。点击"上传文件"或"手动添加"开始创建。</div>
      ) : (
        <div className="knowledge-list">
          {entries.slice().reverse().map(e => (
            <div key={e.id} className="knowledge-entry">
              <div className="knowledge-entry__header">
                <div>
                  <div className="knowledge-entry__title">{e.title}</div>
                  <span className="knowledge-entry__course">{e.course}</span>
                </div>
                <button className="knowledge-entry__del" onClick={() => handleDelete(e.id)}>删除</button>
              </div>
              <div className={`knowledge-entry__content ${expandedIds.has(e.id) ? 'knowledge-entry__content--expanded' : ''}`}><MarkdownContent content={e.content} /></div>
              {e.content.length > 100 && (
                <button className="knowledge-entry__expand" onClick={() => setExpandedIds(prev => { const n = new Set(prev); if (n.has(e.id)) n.delete(e.id); else n.add(e.id); return n })}>
                  {expandedIds.has(e.id) ? '收起' : '展开全部'}
                </button>
              )}
              <div className="knowledge-entry__time">{new Date(e.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Navbar ────────────────────────────────────── */
function Navbar({ user, onLogout, scrolled }) {
  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <a href="/" className="navbar__logo">AI <span>NKU</span></a>
        <div className="navbar__links">
          <a href="/">首页</a>
          {user ? (
            <div className="navbar__user">
              <span className="navbar__userId">{user.studentId} · 教师</span>
              <button className="navbar__logoutBtn" onClick={onLogout}>退出</button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  )
}

/* ── Hero ──────────────────────────────────────── */
function Hero({ onStart }) {
  return (
    <section id="hero" className="hero">
      <div className="hero__bg" />
      <div className="hero__content">
        <p className="hero__badge">南开大学 · 教师端</p>
        <h1 className="hero__title">掌握学情，<br />管理知识。</h1>
        <p className="hero__subtitle">查看学生提问、管理知识库，辅助教学决策。</p>
        <button className="hero__cta" onClick={onStart}>进入教师端</button>
      </div>
    </section>
  )
}

/* ── Teacher Hero ──────────────────────────────── */
function TeacherHero() {
  return (
    <section className="features" style={{ paddingTop: 80, paddingBottom: 40 }}>
      <h2 className="features__title">教师工作台</h2>
    </section>
  )
}

/* ── 主页面 ──────────────────────────────────── */
export default function TeacherPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [tab, setTab] = useState('students')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [subject, setSubject] = useState('')
  const [subjects, setSubjects] = useState([])
  const [loginId, setLoginId] = useState('')
  const [loginError, setLoginError] = useState('')
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    if (user?.role === 'teacher') {
      fetch('/api/teacher/subjects').then(r => r.json()).then(setSubjects).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.authenticated) { setUser(false); setAuthChecked(true); return }
      if (d.user.role !== 'teacher') { navigate('/student', { replace: true }); return }
      setUser(d.user); setAuthChecked(true)
    }).catch(() => { setUser(false); setAuthChecked(true) })
  }, [navigate])

  useEffect(() => {
    if (authChecked && !user) navigate('/', { replace: true })
  }, [user, authChecked, navigate])

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    if (!loginId.trim()) return
    setLogging(true); setLoginError('')
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: loginId.trim() }) })
      const data = await res.json()
      if (!res.ok) { throw new Error(data.error || '登录失败') }
      setUser(data.user); setAuthChecked(true)
    } catch (err) { setLoginError(err.message) } finally { setLogging(false) }
  }

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    navigate('/')
  }, [navigate])

  const handleStart = () => {
    if (!user) {
      document.getElementById('teacher-login')?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    document.getElementById('teacher-dashboard')?.scrollIntoView({ behavior: 'smooth' })
  }

  // 加载中
  if (!authChecked) {
    return (
      <>
        <Navbar user={null} onLogout={handleLogout} scrolled={scrolled} />
        <div className="app-loading" style={{ minHeight: '100vh' }}><div className="app-loading__spinner" /></div>
      </>
    )
  }

  // 未登录：完整 Landing 风格登录页
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar user={null} onLogout={handleLogout} scrolled={scrolled} />
        <Hero onStart={handleStart} />
        <section id="teacher-login" className="features" style={{ paddingTop: 40 }}>
          <h2 className="features__title">教师登录</h2>
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <form onSubmit={handleLoginSubmit}>
                <input
                  style={{
                    width: '100%', padding: '16px 18px', fontSize: 16, borderRadius: 14,
                    border: '2px solid #e8e8ed', outline: 'none', textAlign: 'center',
                    boxSizing: 'border-box', background: '#f5f5f7', color: '#1d1d1f',
                    transition: 'border-color 0.2s, background 0.2s', fontWeight: 500,
                  }}
                  placeholder="请输入工号"
                  value={loginId}
                  onChange={e => { setLoginId(e.target.value); setLoginError('') }}
                  onFocus={e => { e.target.style.borderColor = '#6C2D82'; e.target.style.background = '#fff' }}
                  onBlur={e => { e.target.style.borderColor = '#e8e8ed'; e.target.style.background = '#f5f5f7' }}
                  disabled={logging} autoFocus
                />
                {loginError && <p style={{ color: '#dc2626', fontSize: 14, marginTop: 12, textAlign: 'center' }}>{loginError}</p>}
                <button type="submit" disabled={logging || !loginId.trim()}
                  style={{
                    marginTop: 16, width: '100%', padding: '16px', fontSize: 16, fontWeight: 600,
                    color: '#fff',
                    background: loginId.trim() && !logging ? 'linear-gradient(135deg, #6C2D82, #8B5CF6)' : '#d4b3df',
                    border: 'none', borderRadius: 14,
                    cursor: loginId.trim() && !logging ? 'pointer' : 'default',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => { if (!logging && loginId.trim()) e.target.style.opacity = '0.9' }}
                  onMouseLeave={e => { if (!logging && loginId.trim()) e.target.style.opacity = '1' }}
                >{logging ? '登录中…' : '登录'}</button>
              </form>
            </div>
          </div>
        </section>
        <footer className="footer"><p>AI-NKU &mdash; 南开大学智能助教 · 演示版本</p></footer>
      </div>
    )
  }

  // 已登录：教师工作台
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f7' }}>
      <Navbar user={user} onLogout={handleLogout} scrolled={scrolled} />
      <TeacherHero />
      <section id="teacher-dashboard" className="features" style={{ paddingTop: 0 }}>
        <div className="teacher-body" style={{ display: 'flex', gap: 24, padding: 0 }}>
          <aside className="teacher-sidebar" style={{ width: 200, background: '#fff', borderRadius: 16, border: '1px solid #e5e5ea', padding: '12px 0', flexShrink: 0 }}>
            <button className={`teacher-sidebar__btn ${tab === 'students' ? 'teacher-sidebar__btn--active' : ''}`}
              onClick={() => { setTab('students'); setSelectedStudent(null) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              学生提问
            </button>
            <button className={`teacher-sidebar__btn ${tab === 'knowledge' ? 'teacher-sidebar__btn--active' : ''}`}
              onClick={() => setTab('knowledge')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              知识库
            </button>
          </aside>
          <main className="teacher-main" style={{ flex: 1, background: 'transparent', padding: 0 }}>
            {tab === 'students' && (
              selectedStudent
                ? <StudentDetail studentId={selectedStudent} subject={subject} onBack={() => setSelectedStudent(null)} />
                : (
                  <>
                    <div className="teacher-main__header">
                      <h2 className="teacher-main__title" style={{ marginBottom: 0 }}>学生提问</h2>
                      <div className="subject-filter">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>
                        <select value={subject} onChange={e => { setSubject(e.target.value); setSelectedStudent(null) }} className="subject-filter__select">
                          <option value="">全部学科</option>
                          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <StudentList onSelect={setSelectedStudent} subject={subject} />
                  </>
                )
            )}
            {tab === 'knowledge' && <KnowledgeManager />}
          </main>
        </div>
      </section>
      <footer className="footer"><p>AI-NKU &mdash; 南开大学智能助教 · 演示版本</p></footer>
    </div>
  )
}
