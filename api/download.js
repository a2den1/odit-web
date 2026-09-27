const { send, readBody, getReleases, verifyCaptcha, makeTicket, clientIp, productOf } = require('./_lib')

// POST { token, assetId, product } → { url, name, version, ticket }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
  const body = await readBody(req)

  if (!(await verifyCaptcha(body.token, clientIp(req)))) {
    return send(res, 403, { error: '보안 확인에 실패했습니다. 다시 시도해 주세요.' })
  }

  let releases
  const product = productOf(body.product)
  try { releases = await getReleases(product) } catch { return send(res, 502, { error: '릴리스 목록을 불러오지 못했습니다' }) }

  let found = null
  for (const r of releases) {
    const a = body.assetId === 'latest'
      ? (!r.prerelease && (r.assets.find((x) => /setup.*\.exe$/i.test(x.name)) || r.assets.find((x) => /\.exe$/i.test(x.name))))
      : r.assets.find((x) => String(x.id) === String(body.assetId))
    if (a) { found = { r, a }; break }
  }
  if (!found) return send(res, 404, { error: '파일을 찾지 못했습니다' })

  send(res, 200, {
    url: found.a.url,
    name: found.a.name,
    version: found.r.version,
    ticket: makeTicket({ v: found.r.version, f: found.a.name, p: product }),
  }, { 'Cache-Control': 'no-store' })
}
