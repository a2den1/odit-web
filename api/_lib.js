// Shared helpers for the /api functions. Files starting with "_" are not
// deployed as endpoints by Vercel.
const crypto = require('crypto')

const REPO = process.env.GITHUB_REPO || 'a2den1/odit-web'

// hCaptcha's published test pair: always passes. Used until real keys are set.
const TEST_SITEKEY = '10000000-ffff-ffff-ffff-000000000001'
const TEST_SECRET = '0x0000000000000000000000000000000000000000'
const SITEKEY = process.env.HCAPTCHA_SITEKEY || TEST_SITEKEY
const CAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || TEST_SECRET

const TICKET_SECRET = process.env.TICKET_SECRET || process.env.HCAPTCHA_SECRET || process.env.DISCORD_BOT_TOKEN || 'odit-local-dev'
const TICKET_TTL = 2 * 60 * 60 * 1000

function send(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(JSON.stringify(body))
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > 64 * 1024) break
    chunks.push(c)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { return {} }
}

/* ------------------------------------------------------------ releases */

let cache = { at: 0, data: null }

async function getReleases() {
  if (cache.data && Date.now() - cache.at < 5 * 60 * 1000) return cache.data
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'odit-web' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers })
  if (!r.ok) {
    if (cache.data) return cache.data
    throw new Error('github ' + r.status)
  }
  const list = await r.json()
  const data = list
    .filter((x) => !x.draft)
    .map((x) => ({
      tag: x.tag_name,
      version: String(x.tag_name || '').replace(/^v/i, ''),
      name: x.name || x.tag_name,
      date: x.published_at,
      prerelease: !!x.prerelease,
      notes: String(x.body || '').slice(0, 4000),
      assets: (x.assets || [])
        .filter((a) => !/\.(blockmap|yml|yaml)$/i.test(a.name))
        .map((a) => ({ id: a.id, name: a.name, size: a.size, url: a.browser_download_url })),
    }))
  cache = { at: Date.now(), data }
  return data
}

/** Public view of the releases — download URLs stay on the server. */
const publicReleases = (list) => list.map((r) => ({
  ...r,
  assets: r.assets.map(({ url, ...a }) => a),
}))

/* ------------------------------------------------------------- captcha */

async function verifyCaptcha(token, ip) {
  if (!token || typeof token !== 'string' || token.length > 8192) return false
  const form = new URLSearchParams({ secret: CAPTCHA_SECRET, response: token, sitekey: SITEKEY })
  if (ip) form.set('remoteip', ip)
  try {
    const r = await fetch('https://api.hcaptcha.com/siteverify', { method: 'POST', body: form })
    const j = await r.json()
    return !!j.success
  } catch {
    return false
  }
}

/* ------------------------------------------------------------- tickets */
// A download hands out a short-lived signed ticket; the survey needs one, so
// the survey endpoint can't be sprayed without solving a captcha first.

function makeTicket(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, t: Date.now(), n: crypto.randomBytes(6).toString('hex') })).toString('base64url')
  const sig = crypto.createHmac('sha256', TICKET_SECRET).update(body).digest('base64url')
  return body + '.' + sig
}

function readTicket(ticket) {
  if (typeof ticket !== 'string' || ticket.length > 2048) return null
  const [body, sig] = ticket.split('.')
  if (!body || !sig) return null
  const want = crypto.createHmac('sha256', TICKET_SECRET).update(body).digest('base64url')
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (Date.now() - data.t > TICKET_TTL) return null
    return data
  } catch {
    return null
  }
}

const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || ''

module.exports = {
  REPO, SITEKEY, send, readBody, getReleases, publicReleases, verifyCaptcha, makeTicket, readTicket, clientIp,
}
