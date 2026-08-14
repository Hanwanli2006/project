import mammoth from 'mammoth'
// pdf-parse 必须锁 1.1.1，纯 CJS，ESM 下要这样取 default
import * as pdfParseNS from 'pdf-parse/lib/pdf-parse.js'
const pdfParse = pdfParseNS.default

const COMPRESS_THRESHOLD = 4000 // 超过才压缩
const MAX_TEXT = 200000 // 超过拒绝

export async function parseBuffer(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  if (ext === 'txt' || ext === 'md') {
    return buffer.toString('utf-8').replace(/^﻿/, '')
  }
  if (ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  if (ext === 'pdf') {
    const result = await pdfParse(buffer)
    return result.text
  }
  throw new Error('不支持的文件类型，仅支持 docx / pdf / txt / md')
}

export async function compressChunk(openai, text, title) {
  const trimmed = text.trim()
  if (trimmed.length <= COMPRESS_THRESHOLD) return trimmed
  if (trimmed.length > MAX_TEXT) throw new Error('文件过大，请拆分后上传')

  const chunks = splitIntoChunks(trimmed, 8000)
  const parts = []
  for (const chunk of chunks) {
    const res = await openai.chat.completions.create({
      model: process.env.MODEL || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是知识整理助手。把用户给的资料压缩成结构化 Markdown：用 ## 分节、要点用列表、保留关键概念/公式/例题。不要遗漏重要信息，不要编造。',
        },
        { role: 'user', content: `资料标题：${title}\n\n资料内容：\n${chunk}` },
      ],
    })
    parts.push(res.choices[0].message.content)
  }
  return parts.join('\n\n')
}

function splitIntoChunks(text, maxLen) {
  const paragraphs = text.split('\n\n')
  const chunks = []
  let current = ''
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > maxLen && current) {
      chunks.push(current)
      current = p
    } else {
      current = current ? `${current}\n\n${p}` : p
    }
  }
  if (current) chunks.push(current)
  return chunks
}
