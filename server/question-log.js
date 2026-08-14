import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, 'question-logs')

function ensureDir() {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
}

function getFile(studentId) {
  ensureDir()
  return join(DIR, `${studentId}.json`)
}

export function loadQuestions(studentId) {
  const f = getFile(studentId)
  if (!existsSync(f)) return []
  try { return JSON.parse(readFileSync(f, 'utf-8')) } catch { return [] }
}

export function saveQuestion(studentId, question, subject = '通用') {
  const list = loadQuestions(studentId)
  const entry = { id: Date.now().toString(), question, answer: '', subject, timestamp: new Date().toISOString() }
  list.push(entry)
  writeFileSync(getFile(studentId), JSON.stringify(list, null, 2))
  return entry
}

export function updateAnswer(studentId, questionId, answer) {
  const list = loadQuestions(studentId)
  const idx = list.findIndex(q => q.id === questionId)
  if (idx !== -1) {
    list[idx].answer = answer
    writeFileSync(getFile(studentId), JSON.stringify(list, null, 2))
  }
}

// courses 为 null/undefined 时不过滤（老师未配置课程 = 看全部）
export function getAllStudents(subject, courses) {
  ensureDir()
  const files = readdirSync(DIR).filter(f => f.endsWith('.json'))
  return files.map(f => {
    const studentId = f.replace('.json', '')
    const questions = JSON.parse(readFileSync(join(DIR, f), 'utf-8'))
    const filtered = questions.filter(q => {
      if (subject && q.subject !== subject) return false
      if (courses && (!q.subject || !courses.includes(q.subject))) return false
      return true
    })
    if (filtered.length === 0) return null
    return {
      studentId,
      questionCount: filtered.length,
      lastActive: filtered[filtered.length - 1].timestamp,
    }
  }).filter(Boolean)
}

export function getAllSubjects(courses) {
  ensureDir()
  const files = readdirSync(DIR).filter(f => f.endsWith('.json'))
  const subjectSet = new Set()
  for (const f of files) {
    const questions = JSON.parse(readFileSync(join(DIR, f), 'utf-8'))
    for (const q of questions) {
      if (q.subject && (!courses || courses.includes(q.subject))) subjectSet.add(q.subject)
    }
  }
  return Array.from(subjectSet).sort()
}
