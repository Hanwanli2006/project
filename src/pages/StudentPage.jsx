import { useState, useRef, useEffect, forwardRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import remarkDisplayInlineMath from '../remark-display-inline-math.js'
import 'katex/dist/katex.min.css'
import '../App.css'

/* ── 工具函数 ──────────────────────────────────── */
function maskStudentId(id) {
  if (!id || id.length < 5) return id
  return id.slice(0, 3) + '****' + id.slice(-2)
}

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

function renderContent(content) {
  if (Array.isArray(content)) {
    const images = content.filter(c => c.type === 'image_url')
    const text = content.filter(c => c.type === 'text').map(c => c.text).join('\n')
    return (
      <>
        {images.map((img, i) => (
          <img key={i} src={img.image_url.url} className="chat-msg__image" alt="用户上传的图片" />
        ))}
        {text && <MarkdownContent content={text} />}
      </>
    )
  }
  if (typeof content === 'string') {
    return <MarkdownContent content={content} />
  }
  return content
}

function ChatMessage({ role, content }) {
  return (
    <div className={`chat-msg chat-msg--${role}`}>
      <div className="chat-msg__avatar">
        {role === 'assistant' ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4z"/></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        )}
      </div>
      <div className="chat-msg__bubble">
        {renderContent(content)}
      </div>
    </div>
  )
}

const ChatInput = forwardRef(function ChatInput({ onSend, disabled }, ref) {
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [docFile, setDocFile] = useState(null) // { name, text }
  const [converting, setConverting] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const docInputRef = useRef(null)
  const composingRef = useRef(false)
  useEffect(() => { if (!disabled) (ref?.current || textareaRef.current)?.focus() }, [disabled, ref])
  const autoResize = () => {
    const el = textareaRef.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px' }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return }
    if (file.size > 10 * 1024 * 1024) { alert('图片不能超过 10MB'); return }
    setImage({ file, preview: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const handleDocSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 20 * 1024 * 1024) { alert('文件不能超过 20MB'); return }
    setConverting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/convert', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '转换失败')
      }
      const { text: convertedText } = await res.json()
      setDocFile({ name: file.name, text: convertedText })
    } catch (err) { alert('文件处理失败：' + err.message) } finally { setConverting(false) }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if ((!text.trim() && !image && !docFile) || disabled) return
    onSend(text.trim(), image?.file || null, docFile?.text || null)
    setText('')
    if (image) { URL.revokeObjectURL(image.preview); setImage(null) }
    if (docFile) setDocFile(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) { e.preventDefault(); handleSubmit(e) }
  }
  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="chat-input__body">
        {image && (
          <div className="chat-input__image-preview">
            <img src={image.preview} alt="预览" />
            <button type="button" className="chat-input__image-remove" onClick={() => { URL.revokeObjectURL(image.preview); setImage(null) }}>×</button>
          </div>
        )}
        {converting && (
          <div className="chat-input__image-preview" style={{ alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#86868b' }}>正在转换文件…</span>
          </div>
        )}
        {docFile && (
          <div className="chat-input__image-preview" style={{ alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style={{ fontSize: 13, color: '#3a3a3c' }}>{docFile.name}</span>
            <span style={{ fontSize: 12, color: '#86868b' }}>(已提取文字)</span>
            <button type="button" className="chat-input__image-remove" onClick={() => setDocFile(null)}>×</button>
          </div>
        )}
        <textarea ref={ref || textareaRef} className="chat-input__field" placeholder="输入你的问题… 也可以上传 PDF/Word 文件提问"
          value={text} onChange={e => { setText(e.target.value); autoResize() }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true }}
          onCompositionEnd={() => { setTimeout(() => { composingRef.current = false }, 0) }}
          disabled={disabled} rows={1} />
      </div>
      <div className="chat-input__actions">
        <button type="button" className="chat-input__attach" onClick={() => fileInputRef.current?.click()} disabled={disabled} title="上传图片">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} hidden />
        <button type="button" className="chat-input__attach" onClick={() => docInputRef.current?.click()} disabled={disabled || converting} title="上传文件（PDF/Word/PPT等）">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </button>
        <input ref={docInputRef} type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.html,.md,.csv,.json,.xml" onChange={handleDocSelect} hidden />
        <button type="submit" className="chat-input__btn" disabled={(!text.trim() && !image && !docFile) || disabled || converting}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/></svg>
        </button>
      </div>
    </form>
  )
})

const QUICK_QUESTIONS = ['高数极限怎么求？', '帮我解释线性代数', '怎么写文献综述？', 'C语言指针详解']
const SUBJECTS = ['高等数学', '线性代数', '概率统计', 'C语言', '大学物理', '其他']

function MemoriesPanel({ memories, onAdd, onDelete }) {
  const [text, setText] = useState('')
  const handleAdd = async () => {
    if (!text.trim()) return
    await onAdd(text.trim())
    setText('')
  }
  return (
    <div className="memories-panel">
      <div className="memories-panel__header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4z"/></svg>
        AI 记忆
      </div>
      {memories.length === 0 ? (
        <p className="memories-panel__empty">还没有记忆。添加后 AI 会记住关于你的信息。</p>
      ) : (
        <div className="memories-panel__list">
          {memories.map(m => (
            <div key={m.id} className="memories-panel__item">
              <span>{m.content}</span>
              <button className="memories-panel__del" onClick={() => onDelete(m.id)}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="memories-panel__add">
        <input className="memories-panel__input" placeholder="例如：我大二，正在学高数…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
        <button className="memories-panel__btn" onClick={handleAdd}>记住</button>
      </div>
    </div>
  )
}

function exportMarkdown(messages) {
  const date = new Date().toLocaleString('zh-CN')
  let md = `# AI-NKU 对话记录\n\n导出时间：${date}\n\n---\n\n`
  for (const m of messages) {
    const label = m.role === 'user' ? '你' : 'AI'
    md += `### ${label}\n\n${m.content}\n\n---\n\n`
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AI-NKU-对话记录-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF() {
  document.body.classList.add('printing')
  window.addEventListener('beforeprint', () => { document.body.classList.add('printing') }, { once: true })
  window.addEventListener('afterprint', () => { document.body.classList.remove('printing') }, { once: true })
  setTimeout(() => window.print(), 100)
}

function ExportBar({ messages, onNewChat }) {
  if (messages.length === 0) return null
  return (
    <div className="export-bar">
      <button className="export-bar__btn" onClick={onNewChat} title="新对话">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        新对话
      </button>
      <button className="export-bar__btn" onClick={() => exportMarkdown(messages)} title="导出为 Markdown 文件">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        导出 .md
      </button>
      <button className="export-bar__btn" onClick={exportPDF} title="导出为 PDF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        导出 PDF
      </button>
    </div>
  )
}

function AuthBanner({ status }) {
  if (!status) return null
  const msg = { success: '登录成功！', failed: '登录失败', error: '认证服务异常' }[status]
  return <div className={`auth-banner auth-banner--${status === 'success' ? 'success' : 'error'}`}>{msg}</div>
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
        <button className="hero__cta" onClick={onStartChat}>开始对话</button>
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

/* ── 登录提示 ──────────────────────────────────── */
function LoginPrompt({ onLogin, onDevLogin, devError }) {
  const [devId, setDevId] = useState('')
  return (
    <div className="login-prompt">
      <div className="login-prompt__card">
        <div className="login-prompt__icon" style={{ fontSize: 48, opacity: 0.5 }}>🔒</div>
        <h3 className="login-prompt__title">请先登录</h3>
        <p className="login-prompt__desc">使用南开大学统一身份认证登录后即可使用 AI-NKU</p>
        <button className="login-prompt__btn" onClick={onLogin}>统一身份认证登录</button>
        <div className="login-prompt__dev">
          <p className="login-prompt__devLabel">开发模式：输入学号测试</p>
          <div className="login-prompt__devForm">
            <input className="login-prompt__devInput" placeholder="输入学号" value={devId}
              onChange={e => { setDevId(e.target.value) }}
              onKeyDown={e => { if (e.key === 'Enter') onDevLogin(devId) }} />
            <button className="login-prompt__devBtn" onClick={() => onDevLogin(devId)}>登录</button>
          </div>
          {devError && <p className="login-prompt__devError">{devError}</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Navbar ────────────────────────────────────── */
function Navbar({ user, onLogin, onLogout, hidden }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''} ${hidden ? 'navbar--hidden' : ''}`}>
      <div className="navbar__inner">
        <a href="/" className="navbar__logo">AI <span>NKU</span></a>
        <div className="navbar__links">
          <a href="#hero">首页</a><a href="#features">功能</a><a href="#chat">开始对话</a>
          {user ? (
            <div className="navbar__user">
              <span className="navbar__userId">{maskStudentId(user.studentId)}</span>
              <button className="navbar__logoutBtn" onClick={onLogout}>退出</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="navbar__loginBtn" onClick={onLogin}>统一认证</button>
              <a href="#chat" className="navbar__loginBtn" style={{ background: 'transparent', color: '#6C2D82', border: '1px solid #6C2D82' }}>学号登录</a>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ── App ────────────────────────────────────────── */
export default function StudentPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null); const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [authBanner, setAuthBanner] = useState(null)
  const [navHidden, setNavHidden] = useState(false)
  const [memories, setMemories] = useState([])
  const [showMemories, setShowMemories] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [devError, setDevError] = useState('')
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const chatEndRef = useRef(null); const inputRef = useRef(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = p.get('auth')
    if (s) { setAuthBanner(s); window.history.replaceState({}, '', window.location.pathname); setTimeout(() => setAuthBanner(null), 5000) }
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.authenticated) { setUser(false); return }
      if (d.user.role !== 'student') { navigate('/teacher', { replace: true }); return }
      setUser(d.user)
    }).catch(() => setUser(false))
  }, [navigate])

  useEffect(() => {
    if (user === false) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => { chatEndRef.current?.scrollIntoView() }, [messages, loading])
  useEffect(() => { if (user) fetch('/api/memories').then(r => r.json()).then(setMemories).catch(() => {}) }, [user])

  useEffect(() => {
    const onScroll = () => setNavHidden(window.scrollY > window.innerHeight * 0.7)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = document.getElementById('chat')
    if (!el) return
    const o = new IntersectionObserver(([e]) => setShowInput(e.isIntersecting), { threshold: 0 })
    o.observe(el); return () => o.disconnect()
  }, [user])

  const handleAddMemory = async (content) => {
    try {
      const res = await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
      if (!res.ok) return
      const mem = await res.json()
      setMemories(prev => [...prev, mem])
    } catch {}
  }

  const handleDeleteMemory = async (id) => {
    try { await fetch(`/api/memories/${id}`, { method: 'DELETE' }); setMemories(prev => prev.filter(m => m.id !== id)) } catch {}
  }

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/my/questions')
      const data = await res.json()
      setHistory(data.reverse())
    } catch {} finally { setLoadingHistory(false) }
  }, [])

  const toggleHistory = useCallback(() => {
    setShowHistory(v => {
      if (!v) loadHistory()
      return !v
    })
  }, [loadHistory])

  const handleLogin = useCallback(() => { window.location.href = '/api/auth/login' }, [])

  const handleDevLogin = async (devId) => {
    if (!devId.trim()) return
    setDevError('')
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: devId.trim() }) })
      const data = await res.json()
      if (!res.ok) { throw new Error(data.error || '登录失败') }
      setUser(data.user)
    } catch (err) { setDevError(err.message) }
  }

  const handleLogout = useCallback(async () => { await fetch('/api/auth/logout', { method: 'POST' }); setUser(false); setMessages([]) }, [])

  const handleStartChat = useCallback(() => {
    if (!user) {
      document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => {
        const devInput = document.querySelector('.login-prompt__devInput')
        if (devInput) devInput.focus()
      }, 500)
      return
    }
    document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth' })
    setTimeout(() => inputRef.current?.focus(), 400)
  }, [user])

  const handleSend = async (text, imageFile, docText) => {
    let content
    if (imageFile) {
      const b64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(imageFile)
      })
      content = text
        ? [{ type: 'text', text: docText ? `${text}\n\n[上传文件内容: ${docText}]` : text }, { type: 'image_url', image_url: { url: b64 } }]
        : [{ type: 'image_url', image_url: { url: b64 } }]
      if (docText && !text) {
        content = [{ type: 'text', text: `[上传文件内容: ${docText}]` }, ...content]
      }
    } else if (docText) {
      content = text ? `${text}\n\n[上传文件内容: ${docText}]` : `[上传文件内容: ${docText}]`
    } else { content = text }

    const userMsg = { role: 'user', content }
    setMessages(prev => [...prev, userMsg]); setLoading(true)
    const idx = Date.now()
    setMessages(prev => [...prev, { role: 'assistant', content: '', _id: idx }])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...messages, userMsg], subject }) })
      if (res.status === 401) { setUser(false); throw new Error('登录已过期') }
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.done) break
          setMessages(prev => prev.map(m => m._id === idx ? { ...m, content: m.content + data.content } : m))
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m._id === idx ? { ...m, content: `请求失败：${err.message}` } : m))
    } finally { setLoading(false) }
  }

  const handleQuick = (q) => { if (!loading) handleSend(q, null) }
  const handleNewChat = () => { setMessages([]) }

  if (user === null) {
    return (<><Navbar user={null} onLogin={handleLogin} onLogout={handleLogout} hidden={false} /><div className="app-loading"><div className="app-loading__spinner" /></div></>)
  }

  return (
    <>
      <Navbar user={user} onLogin={handleLogin} onLogout={handleLogout} hidden={navHidden} />
      <AuthBanner status={authBanner} />
      <Hero onStartChat={handleStartChat} />
      <Features />
      <section id="chat" className={`chat-section${user && messages.length > 0 ? ' chat-section--active' : ''}`}>
        <h2 className="chat-section__title">开始对话</h2>
        <div className="chat-body">
          {!user ? <LoginPrompt onLogin={handleLogin} onDevLogin={handleDevLogin} devError={devError} /> : (
            <>
              {messages.length === 0 && (
                <div className="quick-questions">
                  <p className="quick-questions__label">试试这些问题：</p>
                  <div className="quick-questions__grid">
                    {QUICK_QUESTIONS.map(q => <button key={q} className="quick-questions__btn" onClick={() => handleQuick(q)}>{q}</button>)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: 13, color: '#86868b' }}>学科：</span>
                    <select value={subject} onChange={e => setSubject(e.target.value)}
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 14, borderRadius: 8,
                        border: '1px solid #d2d2d7', background: '#fff', color: '#1d1d1f',
                        outline: 'none', cursor: 'pointer',
                      }}>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div className="chat-window">
                {messages.map((m, i) => <ChatMessage key={i} role={m.role} content={m.content} />)}
                {loading && (
                  <div className="chat-msg chat-msg--assistant">
                    <div className="chat-msg__avatar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4z"/></svg></div>
                    <div className="chat-msg__bubble"><span className="typing-dots"><span>.</span><span>.</span><span>.</span></span></div>
                  </div>
                )}
                <ExportBar messages={messages} onNewChat={handleNewChat} />
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                  <button onClick={toggleHistory} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 500, color: '#86868b',
                    padding: '6px 14px', borderRadius: 8,
                    background: '#fff', border: '1px solid #e8e8ed',
                    cursor: 'pointer',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    历史记录
                  </button>
                </div>
                {showHistory && (
                  <div className="memories-panel" style={{ marginTop: 8 }}>
                    <div className="memories-panel__header">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      提问历史
                    </div>
                    {loadingHistory ? (
                      <p className="memories-panel__empty">加载中…</p>
                    ) : history.length === 0 ? (
                      <p className="memories-panel__empty">还没有提问记录</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {history.map((h, i) => (
                          <div key={h.id} style={{
                            fontSize: 13, color: '#3a3a3c', lineHeight: 1.5,
                            padding: '10px 12px', borderRadius: 8,
                            background: '#fff', border: '1px solid #e8e8ed',
                          }}>
                            <div style={{ fontWeight: 600, color: '#6C2D82', fontSize: 12, marginBottom: 4 }}>
                              问题 {history.length - i}
                              <span style={{ color: '#86868b', fontWeight: 400, marginLeft: 8 }}>{new Date(h.timestamp).toLocaleString('zh-CN')}</span>
                            </div>
                            <div style={{ marginBottom: 6 }}>{h.question}</div>
                            {h.answer && (
                              <details>
                                <summary style={{ cursor: 'pointer', color: '#6C2D82', fontSize: 12 }}>查看回答</summary>
                                <div style={{ marginTop: 6, color: '#6e6e73', whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 200, overflowY: 'auto' }}>{h.answer}</div>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </>
          )}
        </div>
      </section>
      <div className={`chat-input-bar ${showInput && user ? 'chat-input-bar--visible' : ''}`}>
        {showMemories && (
          <MemoriesPanel memories={memories} onAdd={handleAddMemory} onDelete={handleDeleteMemory} />
        )}
        <div className="chat-input-bar__row">
          <ChatInput ref={inputRef} onSend={handleSend} disabled={loading} />
          <button className={`chat-input__memory-btn ${showMemories ? 'chat-input__memory-btn--active' : ''}`}
            onClick={() => setShowMemories(v => !v)} title="AI 记忆">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/><path d="M16 14H8a4 4 0 0 0-4 4v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2a4 4 0 0 0-4-4z"/></svg>
            {memories.length > 0 && <span className="chat-input__memory-badge">{memories.length}</span>}
          </button>
        </div>
      </div>
      <footer className="footer"><p>AI-NKU &mdash; 南开大学智能助教 · 演示版本</p></footer>
    </>
  )
}
