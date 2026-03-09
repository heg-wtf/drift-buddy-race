# Drift Buddy Race

Istanbul Park Circuit 기반의 3D 레이싱 게임. 브라우저에서 바로 플레이할 수 있습니다.

## 게임 특징

- Istanbul Park Circuit (CatmullRomCurve3 기반 트랙)
- AI 상대 4대와 경쟁하는 레이스
- 드리프트 & 부스트 메커닉
- 실시간 미니맵, 리더보드, 랩 타임
- 엔진 사운드 (Web Audio API)
- 유럽풍 도시 환경: 건물, 호텔, 고딕 성당, 성, 기마상, 요트

## 조작법

| 키 | 동작 |
|-----|------|
| W / ↑ | 가속 |
| S / ↓ | 브레이크 |
| A / ← | 좌회전 |
| D / → | 우회전 |
| Space | 드리프트 |

## 기술 스택

- **Runtime**: Vite + React 18 + TypeScript
- **3D 렌더링**: Three.js (r160) + React Three Fiber + Drei
- **UI**: shadcn/ui + Tailwind CSS + Radix UI
- **사운드**: Web Audio API
- **상태 관리**: React hooks (useRef, useMemo, useState)

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 프리뷰
npm run preview

# 린트
npm run lint

# 테스트
npm run test
```

## 프로젝트 구조

```
src/
├── components/
│   ├── game/
│   │   ├── RacingGame.tsx    # 메인 게임 루프, Canvas, 상태 관리
│   │   ├── Car.tsx           # 플레이어/AI 차량, 물리, 파티클
│   │   ├── Track.tsx         # 트랙 도로, 배리어, 환경(산, 바다, 잔디)
│   │   ├── TrackObjects.tsx  # 건물, 호텔, 성당, 성, 동상, 광고판, 나무, 요트
│   │   ├── Minimap.tsx       # SVG 기반 미니맵
│   │   ├── GameHUD.tsx       # 속도계, 랩 정보 HUD
│   │   ├── Leaderboard.tsx   # 실시간 순위표
│   │   ├── Grandstand.tsx    # 관중석
│   │   ├── StartCountdown.tsx # 시작 카운트다운
│   │   └── SoundEngine.ts   # 엔진 사운드 관리
│   └── ui/                   # shadcn/ui 컴포넌트
├── pages/
│   ├── Index.tsx             # 메인 페이지
│   └── NotFound.tsx          # 404 페이지
└── ...
```

## 라이선스

Private
