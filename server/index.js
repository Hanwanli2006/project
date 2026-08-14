import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import OpenAI from 'openai'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import multer from 'multer'
import { saveQuestion, updateAnswer, getAllStudents, getAllSubjects, loadQuestions } from './question-log.js'
import { recognize as ocr } from './baidu-ocr.js'
import * as knowledge from './knowledge.js'
import { parseBuffer, compressChunk } from './parser.js'
import { getTeacherCourses } from './teachers.js'
import { checkLimit, record, getDailyCost, getBudget } from './api-usage.js'
import rateLimit from 'express-rate-limit'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── File upload ─────────────────────────────────────────
// memoryStorage 不落盘；只收 docx/pdf/txt/md，超出 20MB 抛 MulterError
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase()
    if (['docx', 'pdf', 'txt', 'md'].includes(ext)) cb(null, true)
    else cb(new Error('不支持的文件类型，仅支持 docx / pdf / txt / md'))
  },
})

const app = express()

app.set('trust proxy', 1)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))

// ── Session 加固 ───────────────────────────────────────
// 生产环境必须显式设置 SESSION_SECRET，否则启动即退出（防止可伪造的 fallback）
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.error('生产环境必须设置 SESSION_SECRET（随机长字符串），见 .env.example')
  process.exit(1)
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'ai-nku-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // HTTP 临时部署时设 ALLOW_HTTP=true 放行 cookie；否则 production 下 secure 强制 HTTPS，浏览器拒收
    secure: process.env.NODE_ENV === 'production' && !process.env.ALLOW_HTTP,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}))

// ── CAS configuration ──────────────────────────────────
const CAS_BASE_URL = process.env.CAS_BASE_URL || 'https://cas.nankai.edu.cn/cas'
const SERVICE_URL = process.env.CAS_SERVICE_URL || 'http://localhost:3002/api/auth/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ── Auth middleware ────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.user) return next()
  res.status(401).json({ error: '请先登录' })
}

// ── Rate limiting ──────────────────────────────────────
// 防止刷接口烧 API 余额 / 暴力尝试登录,按请求方 IP 计数
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20, // 每分钟最多 20 次提问,正常学生远用不到,够挡刷子
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '提问太频繁了,请稍等一分钟再试' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 15 分钟内最多 20 次登录尝试
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '登录尝试次数过多,请 15 分钟后再试' },
})

// 知识库上传会触发 DeepSeek 压缩（一次长文档可能多次 API 调用），限得比聊天更严
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5, // 每分钟最多 5 次上传
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '上传太频繁了,请稍等一分钟再试' },
})

// ── Role detection ────────────────────────────────────
function detectRole(id) {
  // 南开本科学号：10 位数字，以 2 开头（入学年份）
  if (/^2\d{9}$/.test(id)) return 'student'
  return 'teacher'
}

function requireTeacher(req, res, next) {
  if (req.session.user?.role === 'teacher') return next()
  res.status(403).json({ error: '仅教师可访问' })
}

// ── OpenAI client (DeepSeek) ───────────────────────────
// 定义在文件上传路由之前，供 parser.compressChunk 复用
const openai = new OpenAI({
  baseURL: process.env.API_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.API_KEY,
})

// ── CAS: redirect to NKU login ────────────────────────
app.get('/api/auth/login', (req, res) => {
  const loginUrl = `${CAS_BASE_URL}/login?service=${encodeURIComponent(SERVICE_URL)}`
  res.redirect(loginUrl)
})

// ── CAS: ticket validation callback ───────────────────
app.get('/api/auth/callback', async (req, res) => {
  const { ticket } = req.query
  if (!ticket) return res.redirect(`${FRONTEND_URL}/?auth=failed`)

  try {
    const validateUrl = `${CAS_BASE_URL}/serviceValidate?service=${encodeURIComponent(SERVICE_URL)}&ticket=${encodeURIComponent(ticket)}`
    const resp = await fetch(validateUrl, { signal: AbortSignal.timeout(10000) })
    const xml = await resp.text()

    // Parse CAS XML: <cas:user>studentId</cas:user>
    const match = xml.match(/<cas:user>([^<]+)<\/cas:user>/)
    if (!match) return res.redirect(`${FRONTEND_URL}/?auth=failed`)

    const studentId = match[1]
    req.session.user = { studentId, role: detectRole(studentId) }
    res.redirect(`${FRONTEND_URL}/?auth=success`)
  } catch (err) {
    console.error('CAS validation error:', err)
    res.redirect(`${FRONTEND_URL}/?auth=error`)
  }
})

// ── Dev mock login (only in non-production) ───────────
app.post('/api/auth/dev-login', authLimiter, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'dev-login 仅在开发环境可用' })
  }
  const { studentId } = req.body
  if (!studentId) return res.status(400).json({ error: '缺少学号' })
  if (!/^\d{4,10}$/.test(studentId)) return res.status(400).json({ error: '学号/工号格式不正确' })

  req.session.user = { studentId, role: detectRole(studentId) }
  res.json({ authenticated: true, user: { studentId, role: detectRole(studentId) } })
})

// ── Get current user ──────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user })
  } else {
    res.json({ authenticated: false })
  }
})

// ── Logout ────────────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true })
  })
})

// ── Teacher API ──────────────────────────────────────

// GET /api/teacher/students — 获取提问过的学生列表（可选按学科 + 老师课程过滤）
app.get('/api/teacher/students', requireAuth, requireTeacher, (req, res) => {
  const subject = req.query.subject
  const courses = getTeacherCourses(req.session.user.studentId)
  const students = getAllStudents(subject || undefined, courses)
  res.json(students)
})

// GET /api/my/questions — 学生查看自己的提问历史
app.get('/api/my/questions', requireAuth, (req, res) => {
  const studentId = req.session.user.studentId
  const subject = req.query.subject
  let questions = loadQuestions(studentId)
  if (subject) {
    questions = questions.filter(q => q.subject === subject)
  }
  res.json(questions)
})

// GET /api/teacher/questions/:studentId — 获取某个学生的问题（可选按学科 + 老师课程过滤）
app.get('/api/teacher/questions/:studentId', requireAuth, requireTeacher, (req, res) => {
  const studentId = req.params.studentId
  const subject = req.query.subject
  const courses = getTeacherCourses(req.session.user.studentId)
  let questions = loadQuestions(studentId)
  if (subject) {
    questions = questions.filter(q => q.subject === subject)
  }
  if (courses) {
    questions = questions.filter(q => !q.subject || courses.includes(q.subject))
  }
  res.json(questions)
})

// GET /api/teacher/knowledge — 获取知识库
app.get('/api/teacher/knowledge', requireAuth, requireTeacher, (req, res) => {
  res.json(knowledge.getAll())
})

// GET /api/teacher/subjects — 获取有提问数据的学科列表（老师只看到他教的课）
app.get('/api/teacher/subjects', requireAuth, requireTeacher, (req, res) => {
  const courses = getTeacherCourses(req.session.user.studentId)
  res.json(getAllSubjects(courses))
})

// POST /api/teacher/knowledge — 添加知识库条目
app.post('/api/teacher/knowledge', requireAuth, requireTeacher, (req, res) => {
  const { title, content, course } = req.body
  if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' })
  const entry = knowledge.add({ title, content, course })
  res.json(entry)
})

// POST /api/teacher/knowledge/upload — 上传文件解析入库（超长自动压缩）
app.post('/api/teacher/knowledge/upload', requireAuth, requireTeacher, uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' })
  try {
    const raw = await parseBuffer(req.file.buffer, req.file.originalname)
    const title = req.body.title?.trim() || req.file.originalname.replace(/\.[^.]+$/, '')
    const course = req.body.course?.trim() || '通用'
    let content = raw
    let compressed = false
    try {
      content = await compressChunk(openai, raw, title)
      compressed = content.trim() !== raw.trim()
    } catch (err) {
      console.error('知识压缩失败，保存原文:', err.message)
    }
    const entry = knowledge.add({ title, content, course })
    res.json({ ...entry, compressed })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/teacher/knowledge/:id — 删除知识库条目
app.delete('/api/teacher/knowledge/:id', requireAuth, requireTeacher, (req, res) => {
  knowledge.remove(req.params.id)
  res.json({ success: true })
})

// POST /api/convert — 学生端上传文件提问，提取纯文本
app.post('/api/convert', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' })
  try {
    const text = await parseBuffer(req.file.buffer, req.file.originalname)
    res.json({ text, filename: req.file.originalname })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── OpenAI chat (requires auth) ───────────────────────
app.post('/api/chat', requireAuth, chatLimiter, async (req, res) => {
  const { messages, subject } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages is required' })
  }

  // 处理图片：用百度 OCR 提取文字
  const clean = await Promise.all(messages.map(async (m) => {
    if (!Array.isArray(m.content)) return m
    const textParts = m.content.filter(c => c.type === 'text')
    const imageParts = m.content.filter(c => c.type === 'image_url')
    if (imageParts.length === 0) return m
    const resultParts = [...textParts]

    for (const img of imageParts) {
      try {
        const ocrText = await ocr(img.image_url.url, 'general')
        if (ocrText.trim()) {
          resultParts.push({ type: 'text', text: '\n[图片内容: ' + ocrText.trim() + ']' })
        }
      } catch (err) {
        console.error('图片识别失败:', err.message)
      }
    }
    return { ...m, content: resultParts }
  }))

  try {
    // 每日 API 预算检查：超了直接拒绝，避免烧钱
    if (!checkLimit()) {
      return res.status(429).json({ error: `今日 API 预算已用完（${getBudget()} 元/天），请明天再试` })
    }

    // 注入记忆
    const memories = loadMemories(req.session.user.studentId)
    const memoryBlock = memories.length > 0
      ? '\n\n关于这个学生你已知的信息：\n' + memories.map(m => `- ${m.content}`).join('\n')
      : ''

    // 注入知识库（按学生选择的学科过滤，避免灌入无关科目）
    const knowledgeBlock = knowledge.getKnowledgeForPrompt(subject)

    const stream = await openai.chat.completions.create({
      model: process.env.MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `你是南开大学的 AI 智能助教，帮助学生解答课程问题、梳理知识、辅助学术探索。${memoryBlock}${knowledgeBlock}

回答要求：
1. 像费曼一样讲解——用最简单直白的语言解释复杂概念，简短有力，一针见血
2. 要有深度——不只讲表面，点出本质、直觉、核心思想
3. 每个知识点配上 1-2 道经典例题（含简要解析），帮助理解
4. 全程用中文回答` },
        ...clean,
      ],
      stream: true,
      stream_options: { include_usage: true }, // 流式响应也要拿 token 用量来算钱
    })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    let fullAnswer = ''
    let usage = null
    for await (const chunk of stream) {
      if (chunk.usage) usage = chunk.usage
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullAnswer += content
        res.write(`data: ${JSON.stringify({ content })}\n\n`)
      }
    }

    // 记账：本次花费累计进当日预算
    if (usage) {
      const cost = record(usage)
      console.log(`[API 用量] 本次 ¥${cost.toFixed(4)}，今日累计 ¥${getDailyCost().toFixed(4)} / ¥${getBudget()}`)
    }

    // 记录学生提问到日志（供教师端查看）
    if (req.session.user?.role === 'student') {
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()
      if (lastUserMsg) {
        const questionText = typeof lastUserMsg.content === 'string'
          ? lastUserMsg.content
          : lastUserMsg.content.filter(c => c.type === 'text').map(c => c.text).join('\n')
        if (questionText.trim()) {
          const entry = saveQuestion(req.session.user.studentId, questionText.trim(), subject || '通用')
          updateAnswer(req.session.user.studentId, entry.id, fullAnswer)
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
  } catch (err) {
    console.error('API error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── Memory storage ─────────────────────────────────────
const MEMORY_DIR = join(__dirname, 'memories')

function getMemoryFile(studentId) {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true })
  return join(MEMORY_DIR, `${studentId}.json`)
}

function loadMemories(studentId) {
  const file = getMemoryFile(studentId)
  if (!existsSync(file)) return []
  try { return JSON.parse(readFileSync(file, 'utf-8')) } catch { return [] }
}

function saveMemories(studentId, memories) {
  writeFileSync(getMemoryFile(studentId), JSON.stringify(memories, null, 2))
}

// GET /api/memories
app.get('/api/memories', requireAuth, (req, res) => {
  const memories = loadMemories(req.session.user.studentId)
  res.json(memories)
})

// POST /api/memories
app.post('/api/memories', requireAuth, (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) return res.status(400).json({ error: '内容不能为空' })
  const memories = loadMemories(req.session.user.studentId)
  const mem = { id: Date.now().toString(), content: content.trim(), createdAt: new Date().toISOString() }
  memories.push(mem)
  saveMemories(req.session.user.studentId, memories)
  res.json(mem)
})

// DELETE /api/memories/:id
app.delete('/api/memories/:id', requireAuth, (req, res) => {
  let memories = loadMemories(req.session.user.studentId)
  memories = memories.filter(m => m.id !== req.params.id)
  saveMemories(req.session.user.studentId, memories)
  res.json({ success: true })
})

// ── 统一错误处理（必须放在所有路由之后）──────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 20MB' : '文件上传失败：' + err.message })
  }
  if (err.message && err.message.includes('不支持的文件类型')) {
    return res.status(400).json({ error: err.message })
  }
  console.error('未处理的错误:', err)
  res.status(500).json({ error: '服务器内部错误' })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`AI-NKU server running on http://localhost:${PORT}`)
  if (process.env.BAIDU_API_KEY && process.env.BAIDU_SECRET_KEY) {
    console.log('百度 OCR 已配置')
  } else {
    console.log('提示：配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY 后可启用图片文字识别')
  }
})
