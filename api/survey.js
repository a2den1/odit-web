const { send, readBody, readTicket } = require('./_lib')

const API = 'https://discord.com/api/v10'
const used = new Set()   // tickets already spent on this instance

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max)

async function discord(path, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
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

// POST { ticket, found, editor, sns, discord, feedback, website(honeypot) }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const b = await readBody(req)

  if (b.website) return send(res, 200, { ok: true })   // bots fill the hidden field
  const ticket = readTicket(b.ticket)
  if (!ticket) return send(res, 403, { error: '다운로드 후에 참여할 수 있어요' })
  if (used.has(b.ticket)) return send(res, 409, { error: '이미 보낸 응답이에요' })

  const found = clean(b.found, 40)
  const editor = clean(b.editor, 40)
  const sns = clean(b.sns, 300)
  const handle = clean(b.discord, 60)
  const feedback = clean(b.feedback, 1800)
  if (!found && !editor && !sns && !feedback) return send(res, 400, { error: '하나 이상 적어 주세요' })

  if (!process.env.DISCORD_BOT_TOKEN) return send(res, 503, { error: '설문 수신이 아직 설정되지 않았어요' })

  const fields = [
    found && { name: '알게 된 곳', value: found, inline: true },
    editor && { name: '만드는 영상', value: editor, inline: true },
    { name: '받은 버전', value: clean(ticket.v, 30) || '-', inline: true },
    sns && { name: 'SNS', value: sns },
    handle && { name: '디스코드', value: handle, inline: true },
  ].filter(Boolean)

  try {
    const to = await recipientId()
    if (!to) throw new Error('no recipient')
    const dm = await discord('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipient_id: to }) })
    await discord(`/channels/${dm.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          title: 'ODIT 설문 응답',
          description: feedback || '*(피드백 없음)*',
          color: 0xccff1f,
          fields,
          footer: { text: clean(ticket.f, 80) },
          timestamp: new Date().toISOString(),
        }],
      }),
    })
    used.add(b.ticket)
    send(res, 200, { ok: true })
  } catch (e) {
    console.error('survey:', e.message)
    send(res, 502, { error: '응답을 전달하지 못했어요. 잠시 후 다시 시도해 주세요.' })
  }
}
