# KOSPI Swing Signal MVP

초보 부업 스윙 투자자를 위한 코스피 시그널 알림기 MVP입니다.

- 자동매매가 아닌 **조건 충족 알림 앱**
- 핵심 축: **추세 + 거래량 + 지지/저항 + 볼린저밴드 (+선택 RSI)**
- 전략식 자유 입력 없이, **정해진 전략 파라미터만 조정**
- mock 실시간 스트림으로 API 키 없이 로컬 실행 가능

참고한 메인 스펙:
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`

## 최근 업데이트 (2026-03-16)

- 루트에서 `npm run dev` 한 번으로 백엔드(FastAPI) + 프론트(Next.js) 동시 실행
- `npm run dev:clean`으로 3000/8000 포트 정리 후 실행 지원
- 종목코드(6자리) 입력 시 종목명 자동 조회 강화
  - 파일 기반 KRX 심볼맵(`services/api/app/data/krx_symbol_map.json`) 우선 조회
  - 조회 API: `GET /api/symbols/resolve?symbol=005930`
- 브라우저는 `http://localhost:3000`만 접속하면 됨 (`/api`, `/ws`는 Next 리라이트 프록시)
- Phase 1 UI 정보구조 정리 완료(기능 추가 없음)
  - 메인 화면을 `개요 / 워치리스트 / 차트 / 시그널 / 설정` 탭으로 분리
  - `apps/web/app/page.tsx`의 비대해진 UI를 섹션 컴포넌트로 분리
  - 차트 탭은 placeholder만 제공(실제 차트/새 API 미구현 유지)
- Phase 3 차트 데이터 계층 추가(백엔드 API + 타입만, UI 미구현)
  - 신규 엔드포인트: `GET /api/chart/{symbol}?limit=240`
  - 응답: 1분봉 `candles`, 지표 `overlays(ma20/ma60/bollinger/rsi14)`, 시그널 `markers`
  - 기존 mock 런타임/시그널 엔진 로직은 유지하고 집계된 캔들/저장된 시그널을 재사용
- 차트 탭 UI 추가(백엔드 기존 chart API 사용)
  - `lightweight-charts` 기반 캔들/거래량 표시
  - MA20/MA60/Bollinger 오버레이 표시
  - RSI 표시 토글, 시그널 마커 토글
  - 워치리스트 종목 클릭 시 차트 탭 이동 + 선택 종목 로드
  - REST 재조회(5초) 방식으로 차트 데이터 갱신
- Phase 4 실시간 차트 업데이트(REST + WebSocket)
  - 초기 로드: `GET /api/chart/{symbol}`
  - 증분 갱신: `WS /ws/live-signals`의 `candle_update`, `candle_closed`
  - mock 모드에서 API 키 없이 로컬 실시간 갱신 검증 가능

## 0.1 Phase 1 UI 정보구조 정리 (로드맵 기준)

- 작업 범위:
  - 탭 구조 도입 및 기존 화면 섹션 분리
  - 기존 API 호출/시그널/워치리스트/설정 동작 유지
- 작업 제외:
  - 차트 라이브러리 추가 없음
  - 백엔드 엔드포인트 추가 없음
  - 전략 로직/설정 모델 변경 없음
- 주요 프론트 파일:
  - `apps/web/components/layout/AppTabs.tsx`
  - `apps/web/components/dashboard/SummarySection.tsx`
  - `apps/web/components/watchlist/WatchlistSection.tsx`
  - `apps/web/components/chart/ChartSection.tsx` (placeholder)
  - `apps/web/components/signals/SignalsSection.tsx`
  - `apps/web/components/settings/SettingsSection.tsx`

## 1. 프로젝트 구조

```text
.
├─ apps/
│  └─ web/                    # Next.js dashboard
├─ services/
│  └─ api/                    # FastAPI backend
│     ├─ app/data/krx_symbol_map.json
│     └─ scripts/update_symbol_map.py
├─ doc/
│  ├─ kospi_swing_signal_spec_beginner_side_hustle.md
│  └─ sample_signal_events.json
├─ IMPLEMENTATION_PLAN.md
└─ .env.example
```

## 2. MVP 구현 범위

포함:
- 워치리스트 추가/삭제/감시 ON/OFF
- 종목코드 입력 시 종목명 실시간 조회(자동 완성)
- mock 실시간 수신
- 1분봉 집계 로직
- MA / 볼린저 / 거래량 배수 / 단순 지지저항 / RSI(선택)
- 시그널: `buy_candidate`, `breakout`, `sell_warning`
- 중복 알림 방지(cooldown)
- 시그널 로그 저장(SQLAlchemy)
- 대시보드/워치리스트/설정/시그널 로그 UI
- WebSocket 실시간 이벤트

제외:
- 자동매매/주문 연동
- AI 예측 모델
- 고급 백테스트 엔진
- 자유 전략 DSL

## 3. 백엔드 실행 (FastAPI)

작업 폴더:
```bash
cd services/api
```

가상환경 생성 및 의존성 설치:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

환경변수:
```bash
copy ..\..\.env.example .env
```

종목코드 사전(KRX) 갱신(선택):
```bash
.venv\Scripts\python scripts\update_symbol_map.py
```
- 생성 파일: `services/api/app/data/krx_symbol_map.json`
- 기본 포함 범위: 코스피/코스닥/코넥스

실행:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

주요 API:
- `GET /health`
- `GET /api/dashboard/summary`
- `GET /api/watchlists`
- `POST /api/watchlists/{id}/items`
- `PATCH /api/watchlists/items/{itemId}`
- `GET /api/symbols/resolve?symbol=005930`
- `GET /api/watchlist/live`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/signals`
- `GET /api/chart/{symbol}?limit=240`
- `WS /ws/live-signals`

차트 API 빠른 테스트:
```bash
curl "http://127.0.0.1:8000/api/chart/005930?limit=240"
```
- `candles`: 1분봉 OHLCV 배열
- `overlays`: `ma20`, `ma60`, `bollinger_upper/mid/lower`, `rsi14` 시계열
- `markers`: 최근 시그널 로그의 차트 마커(매수 후보/돌파 감시/매도 경고)

실시간 차트 이벤트(WS):
- `candle_update`: 진행 중 1분봉 OHLCV 갱신
- `candle_closed`: 1분봉 마감 확정

## 4. 프론트엔드 실행 (Next.js)

작업 폴더:
```bash
cd apps/web
```

의존성 설치:
```bash
npm install
```

환경변수 파일 생성:
```bash
copy ..\..\.env.example .env.local
```

실행:
```bash
npm run dev
```

접속:
- `http://localhost:3000`

## 4.1 한 번에 실행 (권장)

루트 폴더에서 백엔드 + 프론트를 동시에 실행할 수 있습니다.

사전 준비:
- 자동으로 처리됨(최초 1회에만 시간이 조금 걸림)

루트에서 실행:
```bash
npm install
npm run dev
```

포트가 이미 사용 중이면:
```bash
npm run dev:clean
```

- `dev`: 가상환경/의존성/.env 자동 준비 후 동시 실행
- `dev:clean`: 3000/8000 포트 정리 후 동시 실행
- 브라우저는 `http://localhost:3000` 하나만 열면 됨 (`/api`, `/ws`는 Next 프록시)

## 5. 데이터 저장

기본은 SQLite:
- `services/api/app.db` (실행 위치 기준)

PostgreSQL로 교체하려면 `.env`에서 `DATABASE_URL`만 변경하면 됩니다.

## 6. Provider 교체 지점

현재:
- `app/services/market_data/mock_provider.py`

실제 증권사 연동 확장 포인트:
- `app/services/market_data/base.py` (`MarketDataProvider` 인터페이스)
- `app/services/market_data/kis_adapter.py` (KIS 어댑터 스텁)
- `app/workers/runtime.py`의 `_build_provider()`에서 선택

## 7. 초보자 보호 UX 반영

- 대시보드 상단에 "자동매매 아님" 고지
- 시그널을 `매수 후보 / 돌파 감시 / 매도 경고`로 단순화
- 신호마다 이유 문장 출력
- 중복 알림 쿨다운 기본 10분
- 과도한 확신 문구 배제

## 8. 구현 계획/가정 문서

- 계획 + 가정: `IMPLEMENTATION_PLAN.md`

## 9. 빠른 확인 체크리스트

1. 백엔드 실행 후 `http://localhost:8000/health`가 `{"status":"ok"}`인지 확인
2. 프론트 실행 후 대시보드에서 워치리스트/시그널 로그가 보이는지 확인
3. 1~2분 내 mock 데이터로 시그널이 누적되는지 확인
4. 워치리스트 입력칸에 6자리 종목코드를 입력하면 종목명이 자동으로 표시되는지 확인
5. 차트 탭에서 초기 REST 로드 후 `candle_update`/`candle_closed` 이벤트에 따라 현재 봉이 갱신되고 새 봉이 추가되는지 확인
