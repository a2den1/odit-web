const { send, readBody, verifyCaptcha, clientIp, sendDM, clean, SITEKEY } = require('./_lib')

// 포트폴리오 사이트의 문의 폼이 이 엔드포인트로 보낸다. 봇 DM·hCaptcha 설정을 그대로 쓴다.
// 허용할 출처는 CONTACT_ORIGINS(쉼표로 구분)로 더 넣을 수 있다.
const ALLOWED = [
  'https://aiden-portfolio-beta.vercel.app',
  'https://a2den.kro.kr',
  'http://localhost:5200',
  ...String(process.env.CONTACT_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
]
const ALLOWED_RE = /^https:\/\/aiden-portfolio-[a-z0-9]+-aidenmainyt-8668s-projects\.vercel\.app$/

const originOk = (o) => !!o && (ALLOWED.includes(o) || ALLOWED_RE.test(o))

// Vercel caps a request at 4.5 MB; base64 adds a third, so ~3 MB of files fit.
const MAX_FILES = 6
const MAX_TOTAL = 3 * 1024 * 1024

const safeName = (n, i) => {
  const base = clean(n, 80).replace(/[\\/:*?"<>|]+/g, '_').replace(/^\.+/, '')
  return base || `file-${i + 1}`
}

// GET  → { sitekey }
// POST { token, contact, message, files: [{ name, type, data(base64) }], website(honeypot) }
module.exports = async (req, res) => {
  const origin = req.headers.origin || ''
  const cors = originOk(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
    : { Vary: 'Origin' }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v)
    return res.end()
  }
  if (req.method === 'GET') return send(res, 200, { sitekey: SITEKEY }, cors)
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' }, cors)
  if (origin && !originOk(origin)) return send(res, 403, { error: 'forbidden' }, cors)

  const b = await readBody(req, 4.6 * 1024 * 1024)

  if (b.website) return send(res, 200, { ok: true }, cors)
  const contact = clean(b.contact, 200)
  const message = clean(b.message, 3500)
  if (!contact) return send(res, 400, { error: '연락처를 적어 주세요' }, cors)
  if (!message) return send(res, 400, { error: '내용을 적어 주세요' }, cors)

  const list = Array.isArray(b.files) ? b.files.slice(0, MAX_FILES) : []
  const files = []
  let total = 0
  for (const [i, f] of list.entries()) {
    if (!f || typeof f.data !== 'string') continue
    const buf = Buffer.from(f.data, 'base64')
    total += buf.length
    if (total > MAX_TOTAL) return send(res, 413, { error: '첨부 파일은 모두 합쳐 3 MB까지 보낼 수 있어요' }, cors)
    files.push({ name: safeName(f.name, i), type: clean(f.type, 100), buf })
  }

  if (!(await verifyCaptcha(b.token, clientIp(req)))) {
    return send(res, 403, { error: '보안 확인에 실패했습니다. 다시 시도해 주세요.' }, cors)
  }
  if (!process.env.DISCORD_BOT_TOKEN) return send(res, 503, { error: '문의 수신이 아직 설정되지 않았어요' }, cors)

  const fields = [
    { name: '연락처', value: contact },
    files.length && { name: '첨부', value: `${files.length}개` },
  ].filter(Boolean)

  try {
    await sendDM({
      embeds: [{
        title: '포트폴리오 문의',
        description: message,
        color: 0xff7a00,
        fields,
        timestamp: new Date().toISOString(),
      }],
    }, files)
    send(res, 200, { ok: true }, cors)
  } catch (e) {
    console.error('contact:', e.message)
    send(res, 502, { error: '문의를 전달하지 못했어요. 잠시 후 다시 시도해 주세요.' }, cors)
  }
}
