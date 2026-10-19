# Iron Lift 3D · 3대 500 탄탄클럽 탈출기

브라우저에서 바로 하는 3D 헬스 액션 스토리 게임입니다.
짝사랑의 이상형 "몸 좋은 남자"가 되려고 헬스를 시작했는데, 꼬이는 건 몸 좋은 형님들의 모임 탄탄클럽뿐.
그들보다 강해져서 3대 500을 찍어야 탈출할 수 있습니다.

## 조작
| 종목 | 조작 |
|---|---|
| 벤치프레스 | 가슴에 닿는 순간 클릭 → 파워 게이지 바늘이 초록 구간에 오면 클릭 (노란 칸 = PERFECT) |
| 스쿼트 | 누르고 있으면 앉기 → 깊이 구간에서 떼기 → 다시 눌러 밀기 (BRACE 게이지 관리) |
| 데드리프트 | 클릭으로 잡고 마우스 휠을 아래로 굴려 당기기 · 손이 미끄러지면 표시된 키(A/D) |
| 공통 | A/D 또는 ◀/▶ 좌우 균형 · 1/2/3 장비 (암모니아·인저벨트·부스터) |

## 실행
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 에 배포용 파일 생성
```
Node 22.12 이상이 필요합니다 (vite 8).

## 배포 (Render)
`render.yaml`이 들어 있어서 Render 대시보드 → **New → Blueprint** → 이 저장소를 고르면 정적 사이트로 배포됩니다.
직접 설정할 때: **New → Static Site**, Build Command `npm install && npm run build`, Publish Directory `dist`, 환경변수 `NODE_VERSION=22.12.0`.

## 구조
```
src/
  game.js       게임 루프, 상태, HUD, 입력
  lifts.js      종목별 조작 (벤치 게이지 / 스쿼트 홀드 / 데드 휠)
  config.js     난이도·손맛 조절값
  story.js      챕터·스테이지·대사 ({me}, {her} 이름 자리표시자)
  storyUI.js    메뉴, 지도, 대화창, 결과 화면, 이름 정하기
  tutorial.js   관장님 실전 튜토리얼
  portraits.js  캐릭터 초상화 (SVG, 표정 8종, 주인공 체형 4단계)
  names.js      이름 + 한국어 조사 처리
  save.js       진행 저장 (브라우저 localStorage)
  scene.js      Three.js 3D 헬스장
  audio.js      Web Audio 효과음·BGM
```
진행 상황은 각 플레이어의 브라우저에 저장됩니다.
