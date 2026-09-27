# ODIT 소개 페이지

정적 페이지(`index.html`, `download.html`) + Vercel 함수(`api/`). 빌드 과정이 없습니다.
Vercel에서 이 저장소를 가져오면 Framework Preset **Other**, Build/Output 비움으로 바로 배포됩니다.

## 다운로드

설치 파일(약 190 MB)은 이 저장소의 **GitHub Releases**에 올리고, 사이트에 보일 목록은
`data/releases.json`에 **직접** 적습니다(최신이 맨 위). 새 버전이 나오면 릴리스에 파일을 올리고 이 파일에 한 항목을 추가하면 됩니다.
모든 다운로드는 hCaptcha 확인을 거친 뒤 시작되고, 다운로드가 시작되면 설문 창이 뜹니다.

- 저장소가 **공개(public)** 여야 설치 파일을 누구나 받을 수 있습니다.

## Vercel 환경 변수

| 이름 | 용도 |
|---|---|
| `HCAPTCHA_SECRET` | hCaptcha 시크릿 (`ES_`로 시작). 넣으면 ODIT 사이트 키로 진짜 캡차가 켜집니다 |
| `DISCORD_BOT_TOKEN` | 설문 응답을 DM으로 보낼 봇의 **토큰** (Developer Portal → Bot → Reset Token) |
| `DISCORD_USER_ID` | 응답을 받을 사람의 디스코드 사용자 ID. 비우면 봇 애플리케이션 소유자에게 보냅니다 |

사이트 키(`6a406cae-…`)는 코드에 들어 있습니다. `HCAPTCHA_SECRET`이 없으면 hCaptcha 공식 테스트 키로 동작합니다(누구나 통과).
hCaptcha 대시보드의 사이트 설정에 배포 도메인(예: `xxx.vercel.app`)을 추가해야 캡차가 뜹니다.

봇이 DM을 보내려면 받는 사람과 **같은 서버에 봇이 들어가 있어야** 합니다:
`https://discord.com/oauth2/authorize?client_id=1552449660378021978&scope=bot&permissions=0`

## 로컬 실행

```bash
npm run dev
```

`http://localhost:5321` — `api/`도 Vercel과 똑같이 돌아갑니다. 환경 변수는 `.env.local`에 적으면 읽습니다(커밋되지 않음).

스크린샷은 `assets/shots/`의 WebP 파일입니다. ODIT 저장소에서 `npm run showcase`로 다시 찍을 수 있습니다.
