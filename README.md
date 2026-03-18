# KOSPI Swing Signal MVP

초보 부업 스윙 투자자를 위한 코스피 시그널 알림기 MVP입니다.

- 자동매매가 아닌 **조건 충족 알림 앱**
- 핵심 축: **추세 + 거래량 + 지지/저항 + 볼린저밴드 (+선택 RSI)**
- 전략식 자유 입력 없이, **정해진 전략 파라미터만 조정**
- mock 실시간 스트림으로 API 키 없이 로컬 실행 가능

참고한 메인 스펙:
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`

## 최근 업데이트 (2026-03-17)

- 루트에서 `npm run dev` 한 번으로 백엔드(FastAPI) + 프론트(Next.js) 동시 실행
- `npm run dev:clean`으로 3000/8000 포트 정리 후 실행 지원
- 종목코드(6자리) 입력 시 종목명 자동 조회 강화
  - 파일 기반 KRX 심볼맵(`services/api/app/data/krx_symbol_map.json`) 우선 조회
  - 조회 API: `GET /api/symbols/resolve?symbol=005930`
  - 검색 API: `GET /api/symbols/search?q=삼성` (코드 prefix/종목명 부분검색 지원)
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
- 과거 구간 백필/연장 로드(히스토리 확장)
  - KIS 모드 시 시드 단계에서 과거 1분봉을 여러 청크로 backfill 후 `candles_1m`에 저장
  - 차트 API `before` 파라미터로 현재 구간보다 이전 캔들 청크 조회 가능
  - 차트 탭의 `이전 데이터 더 보기` 버튼으로 과거 구간을 왼쪽에 이어붙임(중복 제거)
- 차트 탭 UI 폴리시(정보구조/가독성 개선, 기능 유지)
  - 대형 요약 카드 대신 종목 헤더 바(종목/현재가/변동률/최근 시그널/마지막 반영 시간)
  - 체크박스 중심 조작부를 컴팩트 툴바(심볼 선택, RSI/시그널 토글, 새로고침)로 정리
  - 가격 차트를 메인 포커스로 강조하고, 거래량/RSI/최근 신호 설명을 분리 패널화
  - 차트 마커 텍스트를 축약해 캔들 가독성 개선(상세 이유는 별도 패널 제공)
  - 가격/거래량/RSI 차트의 기본 attribution 로고 숨김 처리(차트 패널 통일성)
- Position Layer 1차(수동 포지션) 추가
  - 워치리스트 종목 추가 시 `미보유/보유중` 선택 필수
  - `보유중`일 때 진입가 + 수량(정수, 1 이상) 필수
  - 워치리스트 행에 포지션 요약(보유상태/진입가/손익률) 표시
  - 워치리스트/차트 탭에서 동일한 포지션 수정 모달 진입 지원
  - 포지션은 watchlist와 분리된 `positions` 모델로 저장(종목당 1개 open 포지션)
- 차트 가독성 개선(legend + 실토글 + timeframe)
  - 차트 범례/컬러 키 추가(양봉/음봉/MA20/MA60/볼린저/시그널/거래량/RSI)
  - 실제 표시 토글 추가: `Candles`, `MA20`, `MA60`, `Bollinger`, `Signal`, `Volume`, `RSI`
  - 차트 시간프레임 선택 추가: `1m`, `5m`, `15m`, `1h`
  - 백엔드는 `1m` 저장 캔들을 기준으로 상위 프레임을 집계해 응답
  - 초기 화면은 전체 fit 대신 최근 구간 중심으로 표시해 캔들 가독성 강화
- Provider 설정 UI 추가(KIS 자격증명 + 모드 제어)
  - 설정 탭에서 `KIS App Key / App Secret / Base URL` 저장 가능(빨간 경고 박스 포함)
  - 자격증명은 서버(`system_config`)에 저장되고, 저장 후 브라우저에 재노출하지 않음
  - `현재 모드/헬스/최근 오류/최근 업데이트` 상태 표시
  - `KIS 연결 테스트`, `Mock/KIS 모드 전환` 버튼 제공
  - KIS 자격증명 저장 전에는 KIS 테스트/전환 비활성화
- KIS 모드 차트 정합성 안정화
  - `Mock -> KIS` 전환 시 감시 종목의 기존 persisted candle을 초기화 후 KIS 히스토리로 재시드
  - 차트/런타임 로드 시 미래 시각 candle을 자동 제외(오염 데이터 방어)
  - 차트 축 시간 포맷을 KST 기준으로 통일(헤더 시각과 일관성 강화)
  - 기본 DB 경로를 프로젝트 루트 `app.db`로 고정해 실행 위치별 DB 분기 문제 완화
- 시그널 로그 삭제 관리 추가
  - 시그널 탭에서 `전체 삭제`, `선택 종목 삭제`, `개별 삭제` 지원
  - 삭제 후 시그널 목록 + 워치리스트 최근 신호 요약을 즉시 재조회해 동기화
  - 현재 단계는 hard delete(복구/휴지통 없음)

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
- `GET /api/symbols/search?q=삼성&limit=10`
- `GET /api/watchlist/live`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/signals`
- `DELETE /api/signals`
- `DELETE /api/signals?symbol=005930`
- `DELETE /api/signals/{id}`
- `GET /api/chart/{symbol}?limit=240&timeframe=1m|5m|15m|1h`
- `GET /api/chart/{symbol}?limit=240&timeframe=1m|5m|15m|1h&before=2026-03-17T09:00:00+09:00`
- `GET /api/positions`
- `GET /api/positions/{symbol}`
- `PATCH /api/positions/{symbol}`
- `POST /api/positions/{symbol}/close`
- `GET /api/system/provider-status`
- `POST /api/system/kis-credentials`
- `PATCH /api/system/provider-mode`
- `POST /api/system/provider-test`
- `WS /ws/live-signals`

차트 API 빠른 테스트:
```bash
curl "http://127.0.0.1:8000/api/chart/005930?limit=240&timeframe=1m"
curl "http://127.0.0.1:8000/api/chart/005930?limit=240&timeframe=5m"
```
- `candles`: 선택한 timeframe 기준 OHLCV 배열 (`1m`, `5m`, `15m`, `1h`)
- `overlays`: `ma20`, `ma60`, `bollinger_upper/mid/lower`, `rsi14` 시계열
- `markers`: 최근 시그널 로그의 차트 마커(매수 후보/돌파 감시/매도 경고)
- `before` 사용 시: 기준 시각 이전 구간을 반환(기준 시각은 제외), 응답 캔들은 오름차순 유지

timeframe 집계 규칙:
- 소스: persisted `1m` closed candles + 메모리 current `1m` candle
- `open`: 구간 첫 봉 open
- `high`: 구간 최고 high
- `low`: 구간 최저 low
- `close`: 구간 마지막 close
- `volume`: 구간 volume 합

과거 히스토리 백필/연장 조회:
- canonical 저장소는 계속 `1m`(`candles_1m`) 하나만 사용
- `5m/15m/1h`는 조회 시점에 `1m`를 집계해서 생성
- KIS 모드에서는 `KIS_HISTORY_BACKFILL_CHUNKS`(기본 3)만큼 과거 청크를 시드 단계에서 추가 적재
- 차트 탭 `이전 데이터 더 보기`는 `before` 기반으로 과거 청크를 prepend
- 중복 키 `(symbol, timeframe, timestamp)`로 중복 저장 방지

실시간 차트 이벤트(WS):
- `candle_update`: 진행 중 1분봉 OHLCV 갱신
- `candle_closed`: 1분봉 마감 확정

실시간 갱신 범위:
- `1m`: WS 이벤트를 즉시 반영(현재 봉 실시간 갱신)
- `5m/15m/1h`: 봉 마감(`candle_closed`) 시점에 API 재조회로 갱신

차트 히스토리 소스(Phase 7):
- `candles_1m` 테이블의 persisted closed candles
- 런타임 메모리의 현재 진행 중 candle(있을 때만)
- API 조립 시 timestamp 기준 정렬/중복 제거 후 `candles` 반환

mock 시간 싱크 주의사항:
- mock은 `1초=1분`으로 가상 시간을 빠르게 전진시킵니다.
- 런타임은 시작 시 DB 마지막 캔들 시각에 mock 가상시간을 자동 정렬합니다.
  - 목적: REST 마지막 봉 시각과 WS tick 시각의 역전을 방지
  - 결과: mock에서도 틱 갱신에 맞춰 차트가 연속적으로 이어짐
- 이 현상은 mock 개발 환경에서 주로 발생하며, 실브로커 production 환경에서는 일반적으로 발생하지 않습니다.
- 그래도 시간이 크게 꼬였을 때는 백엔드 중지 후 `app.db`(또는 `services/api/app.db`, 실행 위치 기준)를 정리하고 재시작하세요.

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
- `app/services/market_data/kis_adapter.py` (실데이터 연동)

실제 증권사 연동 확장 포인트:
- `app/services/market_data/base.py` (`MarketDataProvider` 인터페이스)
- `app/services/market_data/kis_adapter.py` (KIS 인증/시세/분봉 연동)
- `app/workers/runtime.py`의 `_build_provider()`에서 선택

KIS 모드 실행(권장: UI):
1. 설정 탭 > `KIS 자격증명` 카드에서 `App Key / App Secret` 입력 후 저장
2. 설정 탭 > `Provider 제어`에서 `KIS 연결 테스트`
3. `KIS 모드` 버튼으로 전환
4. 상태 카드에서 `현재 모드`, `KIS 설정`, `런타임 상태` 확인

환경변수로도 초기값 설정 가능:
- `MARKET_DATA_PROVIDER` (`mock` | `kis`)
- `KIS_APP_KEY`
- `KIS_APP_SECRET`
- `KIS_BASE_URL`
- `KIS_POLL_INTERVAL_SECONDS`
- `KIS_HISTORY_SEED_LIMIT`
- `KIS_HISTORY_BACKFILL_CHUNKS`
- `KIS_QUOTE_TR_ID`
- `KIS_INTRADAY_TR_ID`

보안/취급 주의(현재 private-use 단계):
- KIS 비밀값은 브라우저 localStorage에 저장하지 않음
- 저장된 비밀값을 상태 API에서 평문으로 반환하지 않음
- 자격증명 저장 성공 후 입력 폼은 비워서 재노출을 줄임

KIS 모드 동작 방식(MVP):
- 초기 히스토리: KIS 분봉 조회(`inquire-time-itemchartprice`) -> DB(`candles_1m`) 저장 -> 런타임 시드
- 실시간: KIS 시세 조회(`inquire-price`) 폴링 -> 기존 캔들 집계/시그널 엔진 재사용
- 주문/계좌/자동매매는 포함하지 않음
- `MARKET_DATA_PROVIDER=mock`로 언제든 로컬 mock 모드 유지 가능

## 7. 포지션 레이어 사용법 (Phase 10)

1. 워치리스트 탭에서 종목코드 6자리를 입력합니다.
2. `미보유` 또는 `보유중`을 선택합니다.
3. `보유중`이면 진입가와 수량(정수)을 반드시 입력합니다. (손절/익절/메모는 선택)
4. `종목 추가`를 누르면 워치리스트 + 포지션 데이터가 함께 저장됩니다.
5. 기존 종목은 워치리스트의 `포지션 수정` 버튼 또는 차트 탭의 `포지션 수정` 버튼으로 변경합니다.
6. 미보유로 저장하거나 `포지션 종료`를 누르면 열린 포지션이 종료됩니다.

이번 단계에서 의도적으로 제외한 항목:
- 별도 포지션 탭
- 다중 매수(멀티 lot) 추적
- 실현손익 워크플로우
- 자동매매/브로커 주문 기능

## 8. 초보자 보호 UX 반영

- 대시보드 상단에 "자동매매 아님" 고지
- 시그널을 `매수 후보 / 돌파 감시 / 매도 경고`로 단순화
- 신호마다 이유 문장 출력
- 중복 알림 쿨다운 기본 10분
- 과도한 확신 문구 배제

## 9. 구현 계획/가정 문서

- 계획 + 가정: `IMPLEMENTATION_PLAN.md`

## 10. 빠른 확인 체크리스트

1. 백엔드 실행 후 `http://localhost:8000/health`가 `{"status":"ok"}`인지 확인
2. 프론트 실행 후 대시보드에서 워치리스트/시그널 로그가 보이는지 확인
3. 1~2분 내 mock 데이터로 시그널이 누적되는지 확인
4. 워치리스트 입력칸에 6자리 종목코드를 입력하면 종목명이 자동으로 표시되는지 확인
4-1. 워치리스트 입력칸에서 종목명(예: `삼성`, `삼성전자`) 검색 결과 목록이 나오고 선택 후 추가되는지 확인
5. 차트 탭에서 초기 REST 로드 후 `candle_update`/`candle_closed` 이벤트에 따라 현재 봉이 갱신되고 새 봉이 추가되는지 확인
6. 백엔드 재시작 후에도 `GET /api/chart/{symbol}`에서 이전 closed candles가 유지되는지 확인
7. 워치리스트 종목 추가 시 `미보유/보유중`을 선택해야 저장되는지 확인
8. `보유중` 선택 시 진입가/수량(정수) 미입력 상태에서 저장이 차단되는지 확인
9. 워치리스트/차트 탭 모두에서 포지션 수정 모달이 열리고 저장/종료가 반영되는지 확인
10. 차트 범례에서 `MA20/MA60/Bollinger/Signal/Volume/RSI/Candles` 토글이 실제로 ON/OFF 되는지 확인
11. 차트 시간프레임을 `1m -> 5m -> 15m -> 1h`로 전환할 때 캔들/지표가 정상 갱신되는지 확인
12. `1m`에서는 WS 실시간 갱신, 상위 프레임에서는 봉 마감 후 재조회 갱신이 동작하는지 확인
13. 시그널 탭에서 `개별 삭제/종목 삭제/전체 삭제` 후 목록과 워치리스트 최근 시그널이 함께 반영되는지 확인
