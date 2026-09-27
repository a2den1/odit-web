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

async function readBody(req, max = 64 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) } catch { return {} } }
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > max) break
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

/* ------------------------------------------------------------- discord */
// Survey answers and bug reports arrive as DMs from the bot.
const DISCORD = 'https://discord.com/api/v10'

async function discord(path, init = {}) {
  const headers = { Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN, ...(init.headers || {}) }
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const r = await fetch(DISCORD + path, { ...init, headers })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`discord ${r.status} ${j.message || ''}`)
  return j
}

let recipient = process.env.DISCORD_USER_ID || null

/** Who gets the DM: DISCORD_USER_ID, or else the bot application's owner. */
async function recipientId() {
  if (recipient) return recipient
  const app = await discord('/oauth2/applications/@me')
  recipient = app.team?.owner_user_id || app.owner?.id || null
  return recipient
}

/** Send one message (embeds, optional files as { name, type, buf }) to the owner's DMs. */
async function sendDM(message, files = []) {
  const to = await recipientId()
  if (!to) throw new Error('no recipient')
  const dm = await discord('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: to }) })
  const payload = { allowed_mentions: { parse: [] }, ...message }
  if (!files.length) {
    return discord(`/channels/${dm.id}/messages`, { method: 'POST', body: JSON.stringify(payload) })
  }
  const form = new FormData()
  payload.attachments = files.map((f, i) => ({ id: i, filename: f.name }))
  form.append('payload_json', JSON.stringify(payload))
  files.forEach((f, i) => form.append(`files[${i}]`, new Blob([f.buf], { type: f.type || 'application/octet-stream' }), f.name))
  return discord(`/channels/${dm.id}/messages`, { method: 'POST', body: form })
}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max)

module.exports = {
  SITEKEY, send, readBody, getReleases, publicReleases, verifyCaptcha, makeTicket, readTicket, clientIp,
  sendDM, clean,
}
