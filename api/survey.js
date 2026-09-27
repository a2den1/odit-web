const { send, readBody, readTicket, sendDM, clean, PRODUCTS, productOf } = require('./_lib')

const used = new Set()   // tickets already spent on this instance

// POST { ticket, found, editor, sns, feedback, website(honeypot) }
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
  const feedback = clean(b.feedback, 1800)
  if (!found && !editor && !sns && !feedback) return send(res, 400, { error: '하나 이상 적어 주세요' })

  if (!process.env.DISCORD_BOT_TOKEN) return send(res, 503, { error: '설문 수신이 아직 설정되지 않았어요' })

  const fields = [
    found && { name: '알게 된 곳', value: found, inline: true },
    editor && { name: '만드는 영상', value: editor, inline: true },
    { name: '받은 버전', value: clean(ticket.v, 30) || '-', inline: true },
    sns && { name: 'SNS', value: sns },
  ].filter(Boolean)

  try {
    await sendDM({
      embeds: [{
        title: PRODUCTS[productOf(ticket.p)].name + ' 설문 응답',
        description: feedback || '*(피드백 없음)*',
        color: 0xccff1f,
        fields,
        footer: { text: clean(ticket.f, 80) },
        timestamp: new Date().toISOString(),
      }],
    })
    used.add(b.ticket)
    send(res, 200, { ok: true })
  } catch (e) {
    console.error('survey:', e.message)
    send(res, 502, { error: '응답을 전달하지 못했어요. 잠시 후 다시 시도해 주세요.' })
  }
}
