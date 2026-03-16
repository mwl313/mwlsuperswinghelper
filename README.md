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
- Phase 7 캔들 히스토리 보강(지속성 + 재시작 복구)
  - closed candle(1분봉)만 DB에 영속 저장 (`candles_1m`)
  - 중복 방지 키: `(symbol, timeframe, timestamp)` unique
  - 차트 API는 저장소 closed candles + 메모리 current candle을 병합해 응답
  - 백엔드 재시작 후에도 기존 closed candles 히스토리 복구 가능
- 차트 탭 UI 폴리시(정보구조/가독성 개선, 기능 유지)
  - 대형 요약 카드 대신 종목 헤더 바(종목/현재가/변동률/최근 시그널/마지막 반영 시간)
  - 체크박스 중심 조작부를 컴팩트 툴바(심볼 선택, RSI/시그널 토글, 새로고침)로 정리
  - 가격 차트를 메인 포커스로 강조하고, 거래량/RSI/최근 신호 설명을 분리 패널화
  - 차트 마커 텍스트를 축약해 캔들 가독성 개선(상세 이유는 별도 패널 제공)

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

차트 히스토리 소스(Phase 7):
- `candles_1m` 테이블의 persisted closed candles
- 런타임 메모리의 현재 진행 중 candle(있을 때만)
- API 조립 시 timestamp 기준 정렬/중복 제거 후 `candles` 반환

mock 시간 싱크 주의사항:
- mock은 `1초=1분`으로 가상 시간을 빠르게 전진시킵니다.
- 이전 실행에서 DB(`app.db`)에 더 미래 시각의 봉이 남아 있으면, 재시작 직후 차트가 잠시 멈춘 것처럼 보일 수 있습니다.
  - 원인: REST로 읽은 마지막 봉 시각 > 현재 mock WS 봉 시각
  - 결과: 프론트가 과거 시각 이벤트를 무시
- 이 현상은 mock 개발 환경에서 주로 발생하며, 실브로커 production 환경에서는 일반적으로 발생하지 않습니다.
- 로컬에서 바로 초기화하려면 백엔드 중지 후 `app.db`(또는 `services/api/app.db`, 실행 위치 기준)를 정리하고 재시작하세요.

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
- Phase 7부터 `candles_1m` 테이블에 closed candle이 누적 저장됨

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
6. 백엔드 재시작 후에도 `GET /api/chart/{symbol}`에서 이전 closed candles가 유지되는지 확인
