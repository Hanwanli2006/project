import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconQa, IconGraph, IconDoc, IconImage, IconBrain, IconHistory,
  IconStudent, IconTeacher, IconCheck, IconChevron,
} from '../icons'

/* ── Navbar ────────────────────────────────────── */
function Navbar({ user, onLogin, scrolled }) {
  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <a href="/" className="navbar__logo">AI <span>NKU</span></a>
        <div className="navbar__links">
          <a href="#hero">首页</a>
          <a href="#features">功能</a>
          <a href="#student">学生</a>
          <a href="#teacher">教师</a>
          {user ? (
            <span className="navbar__userId">
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
      <div className="hero__content">
        <p className="hero__badge">南开大学 · 智能助教</p>
        <h1 className="hero__title">你的学习伙伴，<br />随时在线。</h1>
        <p className="hero__subtitle">AI-NKU 为你解答课程疑问、梳理知识框架、辅助学术探索。</p>
        <div className="hero__actions">
          <button className="hero__cta" onClick={onStartChat}>开始使用</button>
          <a href="#features" className="link-arrow">
            了解功能 <IconChevron />
          </a>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  { title: '课程答疑', desc: '高数、线代、大物、编程…… 各科问题即时解答，支持多轮追问。', Icon: IconQa },
  { title: '知识梳理', desc: '生成思维导图与知识图谱，帮你把零散的知识点连成体系。', Icon: IconGraph },
  { title: '学术辅助', desc: '文献摘要、论文润色、开题思路，科研路上的好帮手。', Icon: IconDoc },
  { title: '图片提问', desc: '拍下题目直接上传，识别其中的公式与文字后作答。', Icon: IconImage },
  { title: 'AI 记忆', desc: '记住你的专业、学习进度与偏好，越用越贴合你的需要。', Icon: IconBrain },
  { title: '提问历史', desc: '随时回看过去的问答记录，按学科整理，方便复习归档。', Icon: IconHistory },
]

function Features() {
  return (
    <section id="features" className="features">
      <div className="section-head">
        <p className="section-head__eyebrow">功能</p>
        <h2 className="section-head__title">它能做什么</h2>
        <p className="section-head__lead">从课后答疑到论文开题，覆盖学习的每一个环节。</p>
      </div>
      <div className="tiles">
        {FEATURES.map(f => (
          <div key={f.title} className="tile">
            <div className="tile__icon"><f.Icon /></div>
            <h3 className="tile__title">{f.title}</h3>
            <p className="tile__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── 大区块:学生端 / 教师端 ────────────────────── */
function Stage({ id, eyebrow, title, lead, items, cta, onCta }) {
  return (
    <section id={id} className="stage">
      <div className="stage__inner">
        <div>
          <p className="stage__eyebrow">{eyebrow}</p>
          <h2 className="stage__title">{title}</h2>
          <p className="stage__lead">{lead}</p>
        </div>
        <div>
          <div className="stage__list">
            {items.map(t => (
              <div key={t} className="stage__item">
                <IconCheck />
                <span>{t}</span>
              </div>
            ))}
          </div>
          <button className="hero__cta" onClick={onCta}>{cta}</button>
        </div>
      </div>
    </section>
  )
}

/* ── 入口选择 ──────────────────────────────────── */
function EntrySection() {
  const [studentId, setStudentId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [loggingS, setLoggingS] = useState(false)
  const [loggingT, setLoggingT] = useState(false)
  const [errorS, setErrorS] = useState('')
  const [errorT, setErrorT] = useState('')

  const handleLogin = async (id, setLogging, setError, onSuccess) => {
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
    <section id="entry" className="features">
      <div className="section-head">
        <p className="section-head__eyebrow">开始</p>
        <h2 className="section-head__title">选择身份</h2>
        <p className="section-head__lead">学生与教师使用同一套账号体系，输入学号或工号即可进入。</p>
      </div>
      <div className="entry-cards">
        <div className="feature-card">
          <div className="feature-card__icon"><IconStudent /></div>
          <h3 className="feature-card__title">学生端</h3>
          <p className="feature-card__desc">AI 答疑、知识梳理、学术辅助</p>
          <form className="entry-form" onSubmit={e => { e.preventDefault(); handleLogin(studentId, setLoggingS, setErrorS, () => window.location.href = '/student') }}>
            <input className="entry-form__input" value={studentId} onChange={e => { setStudentId(e.target.value); setErrorS('') }}
              placeholder="输入学号登录" />
            {errorS && <p className="entry-form__error">{errorS}</p>}
            <button type="submit" className="entry-form__btn" disabled={loggingS || !studentId.trim()}>
              {loggingS ? '登录中…' : '进入学生端'}
            </button>
          </form>
        </div>
        <div className="feature-card">
          <div className="feature-card__icon"><IconTeacher /></div>
          <h3 className="feature-card__title">教师端</h3>
          <p className="feature-card__desc">查看学生提问、管理知识库</p>
          <form className="entry-form" onSubmit={e => { e.preventDefault(); handleLogin(teacherId, setLoggingT, setErrorT, () => window.location.href = '/teacher') }}>
            <input className="entry-form__input" value={teacherId} onChange={e => { setTeacherId(e.target.value); setErrorT('') }}
              placeholder="输入工号登录" />
            {errorT && <p className="entry-form__error">{errorT}</p>}
            <button type="submit" className="entry-form__btn" disabled={loggingT || !teacherId.trim()}>
              {loggingT ? '登录中…' : '进入教师端'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

/* ── 页脚 ──────────────────────────────────────── */
function Footer() {
  return (
    <footer className="footer">
      <div className="footer__cols">
        <div className="footer__col">
          <h4 className="footer__col-title">功能</h4>
          <a href="#features">课程答疑</a>
          <a href="#features">知识梳理</a>
          <a href="#features">学术辅助</a>
        </div>
        <div className="footer__col">
          <h4 className="footer__col-title">学生</h4>
          <a href="/student">开始对话</a>
          <a href="/student">提问历史</a>
          <a href="/student">导出记录</a>
        </div>
        <div className="footer__col">
          <h4 className="footer__col-title">教师</h4>
          <a href="/teacher">学生提问</a>
          <a href="/teacher">知识库管理</a>
        </div>
        <div className="footer__col">
          <h4 className="footer__col-title">关于</h4>
          <span>南开大学</span>
          <span>大学生创新创业项目</span>
          <span>演示版本</span>
        </div>
      </div>
      <div className="footer__legal">
        <p>AI-NKU — 南开大学智能助教 · 演示版本</p>
      </div>
    </footer>
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

  const goTo = useCallback((hash) => {
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleStart = useCallback(() => {
    if (user) {
      if (user.role === 'student') navigate('/student')
      else if (user.role === 'teacher') navigate('/teacher')
      return
    }
    goTo('entry')
  }, [user, navigate, goTo])

  return (
    <>
      <Navbar user={user} onLogin={handleLogin} scrolled={scrolled} />
      <Hero onStartChat={handleStart} />
      <Features />
      <Stage
        id="student" eyebrow="学生端" title="提问、追问，直到弄懂。"
        lead="支持文字、图片、文档三种提问方式。回答带公式渲染与代码高亮，可随时导出归档。"
        items={[
          '拍下题目截图上传，自动识别公式与文字',
          '回答支持 LaTeX 公式与代码块高亮',
          '一键导出 Markdown 或 PDF，方便整理复习',
        ]}
        cta="进入学生端" onCta={() => goTo('entry')}
      />
      <Stage
        id="teacher" eyebrow="教师端" title="看清学生的困惑在哪。"
        lead="汇总每位学生的提问记录，按学科筛选，并可维护课程知识库作为回答依据。"
        items={[
          '学生提问总览，支持按学科筛选',
          '查看每一次问答的完整记录与时间',
          '上传 PDF / Word 构建课程专属知识库',
        ]}
        cta="进入教师端" onCta={() => goTo('entry')}
      />
      <EntrySection />
      <Footer />
    </>
  )
}
