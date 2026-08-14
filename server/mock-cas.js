/**
 * Mock CAS 服务器
 * 模拟南开大学 CAS 统一身份认证，用于本地开发测试。
 * ./cas/login       → 模拟登录页
 * ./cas/serviceValidate → 验证 ticket 返回 XML
 */
import express from 'express'

const app = express()
const PORT = 3003

// 内存中保存已签发的 ticket → studentId 映射
const tickets = new Map()

/* ── 模拟登录页 ────────────────────────────────── */
app.get('/cas/login', (req, res) => {
  const service = encodeURIComponent(req.query.service || '')
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>南开大学统一身份认证（Mock）</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #6C2D82 0%, #8B5CF6 100%);
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: #fff; border-radius: 16px; padding: 48px 40px;
    width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .card h1 { font-size: 22px; color: #1d1d1f; text-align: center; margin-bottom: 8px; }
  .card p { font-size: 14px; color: #86868b; text-align: center; margin-bottom: 28px; }
  .form-group { margin-bottom: 20px; }
  .form-group label { display: block; font-size: 14px; font-weight: 600; color: #1d1d1f; margin-bottom: 6px; }
  .form-group input {
    width: 100%; padding: 12px 14px; font-size: 15px;
    border: 1px solid #d2d2d7; border-radius: 10px; outline: none;
    transition: border-color 0.2s;
  }
  .form-group input:focus { border-color: #6C2D82; box-shadow: 0 0 0 3px rgba(108,45,130,0.15); }
  .form-group input:disabled { background: #f5f5f7; color: #86868b; }
  .btn {
    width: 100%; padding: 14px; font-size: 16px; font-weight: 600;
    color: #fff; background: #6C2D82; border: none; border-radius: 12px;
    cursor: pointer; transition: background 0.2s;
  }
  .btn:hover { background: #7B3F9E; }
  .badge { text-align: center; margin-top: 16px; font-size: 12px; color: #86868b; }
  .badge span { background: #f5f5f7; padding: 2px 8px; border-radius: 4px; }
</style>
</head>
<body>
<div class="card">
  <h1>南开大学统一身份认证</h1>
  <p>Mock 环境 — 仅用于本地开发测试</p>
  <form method="POST" action="/cas/login?service=${service}">
    <div class="form-group">
      <label>学号</label>
      <input type="text" name="studentId" placeholder="请输入学号" required autofocus>
    </div>
    <div class="form-group">
      <label>密码</label>
      <input type="password" name="password" placeholder="任意密码（Mock）" value="123" disabled
             title="Mock 环境密码不校验">
    </div>
    <button type="submit" class="btn">登录</button>
  </form>
  <div class="badge"><span>⚡ Mock CAS · 仅开发环境使用</span></div>
</div>
</body>
</html>
  `)
})

/* ── 模拟登录提交 ──────────────────────────────── */
app.post('/cas/login', express.urlencoded({ extended: false }), (req, res) => {
  const studentId = req.body.studentId
  const service = req.query.service

  if (!studentId || !/^\d{4,10}$/.test(studentId)) {
    return res.status(400).send('学号/工号格式不正确（4-10 位数字）')
  }

  // 签发 ticket
  const ticket = `ST-MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  tickets.set(ticket, studentId)

  // 设置一个"学习期限"等 mock 属性（模拟 CAS 可能返回的属性）
  // 5 分钟后自动清理
  setTimeout(() => tickets.delete(ticket), 5 * 60 * 1000)

  // 重定向回 service（原 callback URL）
  if (service) {
    const separator = service.includes('?') ? '&' : '?'
    res.redirect(302, `${service}${separator}ticket=${ticket}`)
  } else {
    res.send(`登录成功！Ticket: ${ticket}<br>但未提供 service 参数，无法回跳。`)
  }
})

/* ── 模拟 serviceValidate ──────────────────────── */
app.get('/cas/serviceValidate', (req, res) => {
  const ticket = req.query.ticket
  const service = req.query.service

  const studentId = tickets.get(ticket)
  if (!studentId) {
    return res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationFailure code="INVALID_TICKET">
    Ticket '${ticket}' 无效或已过期
  </cas:authenticationFailure>
</cas:serviceResponse>`)
  }

  // 验证成功，返回包含用户信息的 XML
  res.type('xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
  <cas:authenticationSuccess>
    <cas:user>${studentId}</cas:user>
    <cas:attributes>
      <cas:authenticationDate>${new Date().toISOString()}</cas:authenticationDate>
    </cas:attributes>
  </cas:authenticationSuccess>
</cas:serviceResponse>`)
})

app.listen(PORT, () => {
  console.log(`Mock CAS running on http://localhost:${PORT}/cas/login`)
})
