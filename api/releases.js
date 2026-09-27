const { SITEKEY, send, getReleases, publicReleases, productOf } = require('./_lib')

module.exports = async (req, res) => {
  try {
    const product = productOf(new URL(req.url, 'http://x').searchParams.get('p'))
    const releases = publicReleases(await getReleases(product))
    send(res, 200, { sitekey: SITEKEY, releases }, {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    })
  } catch (e) {
    send(res, 502, { sitekey: SITEKEY, releases: [], error: '릴리스 목록을 불러오지 못했습니다' })
  }
}
