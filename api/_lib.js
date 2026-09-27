// Shared helpers for the /api functions. Files starting with "_" are not
// deployed as endpoints by Vercel.
const crypto = require('crypto')

// hCaptcha's published test pair: always passes. Used until real keys are set.
const TEST_SITEKEY = '10000000-ffff-ffff-ffff-000000000001'
const TEST_SECRET = '0x0000000000000000000000000000000000000000'
// ODIT's own site key (public by design). The secret lives only in the
// HCAPTCHA_SECRET environment variable; until it is set, the test pair keeps
// downloads working.
const ODIT_SITEKEY = '6a406cae-af0e-4716-b33a-037062ec0eca'
const CAPTCHA_SECRET = process.env.HCAPTCHA_SECRET || TEST_SECRET
const SITEKEY = process.env.HCAPTCHA_SITEKEY || (process.env.HCAPTCHA_SECRET ? ODIT_SITEKEY : TEST_SITEKEY)

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
// The list is maintained by hand in data/releases.json — newest first.
const RELEASES = require('../data/releases.json')

async function getReleases() {
  return RELEASES.map((r) => ({ prerelease: false, notes: '', ...r, name: 'ODIT ' + r.version }))
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
  SITEKEY, send, readBody, getReleases, publicReleases, verifyCaptcha, makeTicket, readTicket, clientIp,
}
