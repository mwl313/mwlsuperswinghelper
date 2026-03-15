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
- `WS /ws/live-signals`

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
