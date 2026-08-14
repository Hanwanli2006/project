import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, 'api-usage.json')

// DeepSeek 定价（元 / 百万 token），deepseek-chat = v4-flash 非思考模式，2026-07 官方价格
const PRICE_CACHE_HIT = 0.02 // 输入缓存命中
const PRICE_CACHE_MISS = 1.0 // 输入缓存未命中
const PRICE_OUTPUT = 2.0 // 输出

const DEFAULT_BUDGET = 0.5 // 每日预算上限（元）

function today() {
  return new Date().toISOString().slice(0, 10)
}

function load() {
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf-8'))
    // 跨天自动归零：新的一天从 0 开始
    if (data.date !== today()) return { date: today(), cost: 0 }
    return data
  } catch {
    return { date: today(), cost: 0 }
  }
}

function save(data) {
  writeFileSync(FILE, JSON.stringify(data, null, 2))
}

export function getBudget() {
  const b = parseFloat(process.env.DAILY_API_BUDGET)
  return Number.isFinite(b) && b > 0 ? b : DEFAULT_BUDGET
}

export function getDailyCost() {
  return load().cost
}

// 剩余预算；>0 说明还能调用
export function remaining() {
  return getBudget() - load().cost
}

export function checkLimit() {
  return remaining() > 0
}

// 从一次响应的 usage 算出费用并累加，返回本次花费（元）
export function record(usage) {
  if (!usage) return 0
  const hit = usage.prompt_cache_hit_tokens || usage.prompt_tokens_details?.cached_tokens || 0
  const miss = usage.prompt_cache_miss_tokens || (usage.prompt_tokens - hit) || 0
  const output = usage.completion_tokens || 0
  const cost =
    (hit / 1e6) * PRICE_CACHE_HIT +
    (miss / 1e6) * PRICE_CACHE_MISS +
    (output / 1e6) * PRICE_OUTPUT
  const data = load()
  data.cost += cost
  save(data)
  return cost
}
