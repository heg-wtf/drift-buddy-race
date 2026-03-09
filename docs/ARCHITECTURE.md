# Architecture

## 개요

Drift Buddy Race는 React Three Fiber 기반의 브라우저 3D 레이싱 게임입니다. 모든 렌더링과 게임 로직이 클라이언트 측에서 실행됩니다.

## 핵심 아키텍처

### 렌더링 파이프라인

```
Canvas (R3F)
├── Camera (PerspectiveCamera, 3인칭 추적)
├── Lighting (DirectionalLight + AmbientLight)
├── Track (도로, 배리어, 환경)
│   ├── BarrierWall (BufferGeometry 리본)
│   ├── Mountains, Ocean, Grass
│   └── TrackObjects (건물, 호텔, 성당 등)
├── Cars (Player + 4 AI)
│   ├── Body (BoxGeometry + 스폰서 텍스처)
│   ├── Wheels (회전 애니메이션 + 타이어 홈)
│   └── Particles (스파크, 부스트 트레일)
└── HUD Overlay (HTML)
    ├── GameHUD (속도, 랩)
    ├── Minimap (SVG)
    └── Leaderboard
```

### 트랙 시스템

- `CatmullRomCurve3`로 Istanbul Park Circuit 정의 (17개 제어점)
- `getPoints(600)`으로 600개 샘플 포인트 생성
- 도로 폭 기준 내/외곽 경계 계산 → 배리어 위치 결정
- `isPositionSafe()` / `isSafeFromDistantTrack()`로 오브젝트 배치 안전 검증

### 차량 물리

- 커스텀 아케이드 물리 (useFrame 루프)
- velocity, steering, drift 상태 관리 (useRef)
- AI: 트랙 곡선 따라가기 + 약간의 랜덤 오프셋
- 충돌: 트랙 경계 기반 단순 충돌

### 성능 최적화

| 기법 | 적용 위치 |
|------|----------|
| InstancedMesh | 나무, 광고판, 카메라맨 |
| BufferGeometry | 배리어 벽 (연속 리본) |
| Canvas 텍스처 캐싱 | 스폰서 로고 (sponsorTextureCache Map) |
| useMemo | 파티클 배열, 지오메트리, 트랙 경계 |
| useRef 캐싱 | 트랙 포인트 (getPoints 결과) |
| DPR 제한 | `dpr={[1, 1.5]}` |
| Adaptive performance | `performance={{ min: 0.5 }}` |
| Shadow map 축소 | 1024x1024 |

### 프로시저럴 생성

- 시드 기반 의사난수로 결정론적 생성
- 건물 파사드: 창문 색상/커튼/셔터/에어컨/화분 랜덤화
- Canvas API로 동적 텍스처 생성 (간판, 스테인드글라스, 장미창)

## 주요 데이터 흐름

```
RacingGame (상태: gameState, lap, positions)
  ↓ props
  Car (물리 업데이트 → position 콜백)
  ↓ onPositionUpdate
RacingGame (carPositions Map 업데이트)
  ↓ props
  Minimap + Leaderboard (위치 표시)
```

## 사운드

- `SoundEngine.ts`: Web Audio API (AudioContext + AudioBufferSourceNode)
- 엔진 루프 MP3 로드 → playbackRate로 속도 연동
