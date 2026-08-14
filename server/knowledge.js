import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'knowledge')

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

function getFile() {
  ensureDir()
  return join(DIR, 'knowledge.json')
}

export function getAll() {
  const f = getFile()
  if (!existsSync(f)) return []
  try { return JSON.parse(readFileSync(f, 'utf-8')) } catch { return [] }
}

export function add({ title, content, course }) {
  const entries = getAll()
  const entry = {
    id: Date.now().toString(),
    title,
    content,
    course: course || '通用',
    createdAt: new Date().toISOString(),
  }
  entries.push(entry)
  writeFileSync(getFile(), JSON.stringify(entries, null, 2))
  return entry
}

export function remove(id) {
  let entries = getAll()
  entries = entries.filter(e => e.id !== id)
  writeFileSync(getFile(), JSON.stringify(entries, null, 2))
}

export function getAllByCourse() {
  const entries = getAll()
  const grouped = {}
  for (const e of entries) {
    if (!grouped[e.course]) grouped[e.course] = []
    grouped[e.course].push(e)
  }
  return grouped
}

// 只注入指定学科 + "通用"条目；该学科无资料则空注入（避免灌入无关科目）
export function getKnowledgeForPrompt(course) {
  const entries = getAll()
  if (entries.length === 0) return ''
  const filtered = course
    ? entries.filter(e => !e.course || e.course === '通用' || e.course === course)
    : entries
  if (filtered.length === 0) return ''
  return '\n\n可参考的知识库内容：\n' + filtered.map(e =>
    `[${e.course}] ${e.title}\n${e.content}`
  ).join('\n\n')
}
