# ODIT 소개 페이지

정적 페이지(`index.html`, `download.html`) + Vercel 함수(`api/`). 빌드 과정이 없습니다.
Vercel에서 이 저장소를 가져오면 Framework Preset **Other**, Build/Output 비움으로 바로 배포됩니다.

## 다운로드

설치 파일(약 190 MB)은 이 저장소의 **GitHub Releases**에 올립니다. `/download` 페이지가 릴리스 목록을 보여주고,
모든 다운로드는 hCaptcha 확인을 거친 뒤 시작됩니다. 다운로드가 시작되면 설문 창이 뜹니다.

- 릴리스를 새로 만들면 5분 안에 사이트에 반영됩니다.
- 저장소가 **공개(public)** 여야 설치 파일을 누구나 받을 수 있습니다.

## Vercel 환경 변수

| 이름 | 용도 |
|---|---|
| `HCAPTCHA_SITEKEY` | hCaptcha 사이트 키 (dashboard.hcaptcha.com) |
| `HCAPTCHA_SECRET` | hCaptcha 시크릿 |
| `DISCORD_BOT_TOKEN` | 설문 응답을 DM으로 보낼 봇의 **토큰** (Developer Portal → Bot → Reset Token) |
| `DISCORD_USER_ID` | 응답을 받을 사람의 디스코드 사용자 ID. 비우면 봇 애플리케이션 소유자에게 보냅니다 |
| `GITHUB_REPO` | 릴리스를 읽을 저장소. 기본값 `a2den1/odit-web` |
| `GITHUB_TOKEN` | (선택) GitHub API 한도를 늘릴 때 |

hCaptcha 키가 없으면 hCaptcha 공식 테스트 키로 동작합니다(누구나 통과). 실제 운영 전에 꼭 넣으세요.

봇이 DM을 보내려면 받는 사람과 **같은 서버에 봇이 들어가 있어야** 합니다:
`https://discord.com/oauth2/authorize?client_id=1552449660378021978&scope=bot&permissions=0`

## 로컬 실행

```bash
npm run dev
```

`http://localhost:5321` — `api/`도 Vercel과 똑같이 돌아갑니다. 환경 변수는 `.env.local`에 적으면 읽습니다(커밋되지 않음).

스크린샷은 `assets/shots/`의 WebP 파일입니다. ODIT 저장소에서 `npm run showcase`로 다시 찍을 수 있습니다.
