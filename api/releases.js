const { REPO, SITEKEY, send, getReleases, publicReleases } = require('./_lib')

module.exports = async (req, res) => {
  try {
    const releases = publicReleases(await getReleases())
    send(res, 200, { repo: REPO, sitekey: SITEKEY, releases }, {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    })
  } catch (e) {
    send(res, 502, { repo: REPO, sitekey: SITEKEY, releases: [], error: '릴리스 목록을 불러오지 못했습니다' })
  }
}
