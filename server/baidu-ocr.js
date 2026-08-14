/* ── 百度 OCR ────────────────────────────────────
 * 免费额度：通用文字识别 500次/日，手写识别 500次/日
 * 注册领取：https://console.bce.baidu.com/ai/#/ai/ocr/overview
 */

let cachedToken = null
let tokenExpiresAt = 0

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const { BAIDU_API_KEY, BAIDU_SECRET_KEY } = process.env
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    throw new Error('请在 .env 中配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY')
  }

  const res = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`,
    { method: 'POST' }
  )
  const data = await res.json()
  if (data.error) throw new Error(`百度 token 获取失败: ${data.error_description || data.error}`)

  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000 // 提前 60s 刷新
  return cachedToken
}

/**
 * OCR 识别图片
 * @param {string} base64Image - 含 data:image 前缀的 base64
 * @param {'general'|'handwriting'} type - 通用 or 手写
 * @returns {string} 识别出的文字
 */
export async function recognize(base64Image, type = 'general') {
  // 去掉 data:image/...;base64, 前缀
  const raw = base64Image.replace(/^data:image\/\w+;base64,/, '')
  const token = await getAccessToken()

  // 先用通用文字识别（高精度），如果效果不好可以切到手写
  const apiUrl = type === 'handwriting'
    ? 'https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting'
    : 'https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic'

  const res = await fetch(`${apiUrl}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image: raw }),
  })
  const data = await res.json()

  if (data.error_code) {
    // 高精度版可能没开通额度，降级到通用版
    if (data.error_code === 17 || data.error_code === 216100) {
      const fallback = await fetch(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ image: raw }),
        }
      )
      const fbData = await fallback.json()
      if (fbData.error_code) throw new Error(`百度 OCR 错误: ${fbData.error_msg}`)
      return fbData.words_result.map(w => w.words).join('\n')
    }
    throw new Error(`百度 OCR 错误: ${data.error_msg}`)
  }

  return data.words_result.map(w => w.words).join('\n')
}
