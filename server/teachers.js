import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
let cache = null

function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(readFileSync(join(__dirname, 'teachers.json'), 'utf-8'))
  } catch {
    cache = {}
  }
  return cache
}

// 老师工号 → 所教课程白名单；未配置返回 null（默认看全部，宽松）
export function getTeacherCourses(teacherId) {
  const courses = load()[teacherId]
  return courses || null
}
