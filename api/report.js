const { send, readBody, verifyCaptcha, clientIp, sendDM, clean, PRODUCTS, productOf } = require('./_lib')

// Vercel caps a request at 4.5 MB; base64 adds a third, so ~3 MB of files fit.
const MAX_FILES = 6
const MAX_TOTAL = 3 * 1024 * 1024

const safeName = (n, i) => {
  const base = clean(n, 80).replace(/[\\/:*?"<>|]+/g, '_').replace(/^\.+/, '')
  return base || `file-${i + 1}`
}

// POST { token, product, what, steps, version, files: [{ name, type, data(base64) }], website(honeypot) }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const b = await readBody(req, 4.6 * 1024 * 1024)

  if (b.website) return send(res, 200, { ok: true })
  const what = clean(b.what, 3500)
  const steps = clean(b.steps, 1000)
  const version = clean(b.version, 30)
  if (!what) return send(res, 400, { error: '어떤 문제인지 적어 주세요' })

  const list = Array.isArray(b.files) ? b.files.slice(0, MAX_FILES) : []
  const files = []
  let total = 0
  for (const [i, f] of list.entries()) {
    if (!f || typeof f.data !== 'string') continue
    const buf = Buffer.from(f.data, 'base64')
    total += buf.length
    if (total > MAX_TOTAL) return send(res, 413, { error: '첨부 파일은 모두 합쳐 3 MB까지 보낼 수 있어요' })
    files.push({ name: safeName(f.name, i), type: clean(f.type, 100), buf })
  }

  if (!(await verifyCaptcha(b.token, clientIp(req)))) {
    return send(res, 403, { error: '보안 확인에 실패했습니다. 다시 시도해 주세요.' })
  }
  if (!process.env.DISCORD_BOT_TOKEN) return send(res, 503, { error: '제보 수신이 아직 설정되지 않았어요' })

  const fields = [
    { name: '버전', value: version || '모름', inline: true },
    files.length && { name: '첨부', value: `${files.length}개`, inline: true },
    steps && { name: '어떻게 하면 생기나요', value: steps },
  ].filter(Boolean)

  try {
    await sendDM({
      embeds: [{
        title: PRODUCTS[productOf(b.product)].name + ' 버그 제보',
        description: what,
        color: 0xff6b5b,
        fields,
        timestamp: new Date().toISOString(),
      }],
    }, files)
    send(res, 200, { ok: true })
  } catch (e) {
    console.error('report:', e.message)
    send(res, 502, { error: '제보를 전달하지 못했어요. 잠시 후 다시 시도해 주세요.' })
  }
}
