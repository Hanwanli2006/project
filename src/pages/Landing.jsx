import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Navbar ────────────────────────────────────── */
function Navbar({ user, onLogin, scrolled }) {
  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <a href="/" className="navbar__logo">AI <span>NKU</span></a>
        <div className="navbar__links">
          <a href="#hero">首页</a>
          <a href="#features">功能</a>
          <a href="#student">学生</a>
          <a href="#teacher">教师</a>
          {user ? (
            <span className="navbar__userId" style={{ color: '#86868b', fontSize: 14 }}>
              {user.studentId} · {user.role === 'student' ? '学生' : '教师'}
            </span>
          ) : (
            <button className="navbar__loginBtn" onClick={onLogin}>登录</button>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ── Hero ──────────────────────────────────────── */
function Hero({ onStartChat }) {
  return (
    <section id="hero" className="hero">
      <div className="hero__bg" />
      <div className="hero__content">
        <p className="hero__badge">南开大学 · 智能助教</p>
        <h1 className="hero__title">你的学习伙伴，<br />随时在线。</h1>
        <p className="hero__subtitle">AI-NKU 为你解答课程疑问、梳理知识框架、辅助学术探索。</p>
        <button className="hero__cta" onClick={onStartChat}>开始使用</button>
      </div>
    </section>
  )
}

const FEATURES = [
  { title: '课程答疑', desc: '高数、线代、大物、编程…… 各科问题即时解答。', icon: '📚' },
  { title: '知识梳理', desc: '生成思维导图、知识图谱，帮你构建学科体系。', icon: '🧠' },
  { title: '学术辅助', desc: '文献摘要、论文润色、开题思路，科研路上的好帮手。', icon: '📝' },
]

function FeatureCard({ title, desc, icon, i }) {
  return (
    <div className="feature-card" style={{ animationDelay: `${i * 0.1}s` }}>
      <div className="feature-card__icon" style={{ fontSize: 28 }}>{icon}</div>
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__desc">{desc}</p>
    </div>
  )
}

function Features() {
  return (
    <section id="features" className="features">
      <h2 className="features__title">它能做什么</h2>
      <div className="features__grid">{FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} i={i} />)}</div>
    </section>
  )
}

/* ── 入口选择 ──────────────────────────────────── */
function EntrySection({ onStudentLogin, onTeacherLogin }) {
  const [studentId, setStudentId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [loggingS, setLoggingS] = useState(false)
  const [loggingT, setLoggingT] = useState(false)
  const [errorS, setErrorS] = useState('')
  const [errorT, setErrorT] = useState('')

  const handleLogin = async (id, role, setLogging, setError, onSuccess) => {
    if (!id.trim()) return
    setLogging(true); setError('')
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: id.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      onSuccess()
    } catch (err) { setError(err.message) } finally { setLogging(false) }
  }

  return (
    <section id="entry" className="features" style={{ paddingTop: 0 }}>
      <h2 className="features__title">选择身份</h2>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20, maxWidth: 600, margin: '0 auto' }}>
        <div className="feature-card" style={{ padding: '28px 24px', width: 260, flexShrink: 0 }}>
          <div className="feature-card__icon" style={{ fontSize: 32 }}>🎓</div>
          <h3 className="feature-card__title">学生端</h3>
          <p className="feature-card__desc" style={{ marginBottom: 16 }}>AI 答疑、知识梳理、学术辅助</p>
          <form onSubmit={e => { e.preventDefault(); handleLogin(studentId, 'student', setLoggingS, setErrorS, () => window.location.href = '/student') }} style={{ width: '100%' }}>
            <input value={studentId} onChange={e => { setStudentId(e.target.value); setErrorS('') }}
              placeholder="输入学号登录"
              style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '2px solid #e8e8ed', outline: 'none', textAlign: 'center', boxSizing: 'border-box', background: '#f5f5f7' }}
              onFocus={e => e.target.style.borderColor = '#6C2D82'}
              onBlur={e => e.target.style.borderColor = '#e8e8ed'} />
            {errorS && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{errorS}</p>}
            <button type="submit" disabled={loggingS || !studentId.trim()}
              style={{ marginTop: 10, width: '100%', padding: '10px', fontSize: 14, fontWeight: 600, color: '#fff', background: studentId.trim() && !loggingS ? '#6C2D82' : '#d4b3df', border: 'none', borderRadius: 10, cursor: studentId.trim() && !loggingS ? 'pointer' : 'default' }}>
              {loggingS ? '登录中…' : '进入学生端'}
            </button>
          </form>
        </div>
        <div className="feature-card" style={{ padding: '28px 24px', width: 260, flexShrink: 0 }}>
          <div className="feature-card__icon" style={{ fontSize: 32 }}>👨‍🏫</div>
          <h3 className="feature-card__title">教师端</h3>
          <p className="feature-card__desc" style={{ marginBottom: 16 }}>查看学生提问、管理知识库</p>
          <form onSubmit={e => { e.preventDefault(); handleLogin(teacherId, 'teacher', setLoggingT, setErrorT, () => window.location.href = '/teacher') }} style={{ width: '100%' }}>
            <input value={teacherId} onChange={e => { setTeacherId(e.target.value); setErrorT('') }}
              placeholder="输入工号登录"
              style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '2px solid #e8e8ed', outline: 'none', textAlign: 'center', boxSizing: 'border-box', background: '#f5f5f7' }}
              onFocus={e => e.target.style.borderColor = '#6C2D82'}
              onBlur={e => e.target.style.borderColor = '#e8e8ed'} />
            {errorT && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{errorT}</p>}
            <button type="submit" disabled={loggingT || !teacherId.trim()}
              style={{ marginTop: 10, width: '100%', padding: '10px', fontSize: 14, fontWeight: 600, color: '#fff', background: teacherId.trim() && !loggingT ? '#6C2D82' : '#d4b3df', border: 'none', borderRadius: 10, cursor: teacherId.trim() && !loggingT ? 'pointer' : 'default' }}>
              {loggingT ? '登录中…' : '进入教师端'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

/* ── App ───────────────────────────────────────── */
export default function Landing() {
  const [user, setUser] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.authenticated) {
          setUser(d.user)
          // 已登录用户自动跳转
          if (d.user.role === 'student') navigate('/student', { replace: true })
          else if (d.user.role === 'teacher') navigate('/teacher', { replace: true })
        } else {
          setUser(false)
        }
      })
      .catch(() => setUser(false))
  }, [navigate])

  const handleLogin = useCallback(() => {
    window.location.href = '/api/auth/login'
  }, [])

  const handleStart = useCallback(() => {
    if (user) {
      if (user.role === 'student') navigate('/student')
      else if (user.role === 'teacher') navigate('/teacher')
      return
    }
    document.getElementById('entry')?.scrollIntoView({ behavior: 'smooth' })
  }, [user, navigate])

  return (
    <>
      <Navbar user={user} onLogin={handleLogin} scrolled={scrolled} />
      <Hero onStartChat={handleStart} />
      <Features />
      <EntrySection onStudentLogin={handleLogin} onTeacherLogin={handleLogin} />
      <footer className="footer"><p>AI-NKU &mdash; 南开大学智能助教 · 演示版本</p></footer>
    </>
  )
}
