# IMPLEMENTATION PLAN

## 1) Spec-First Summary (Read Before Code)
Main spec read: `doc/kospi_swing_signal_spec_beginner_side_hustle.md`

Core MVP requirements applied as highest priority:
- Product is a signal notifier, not auto-trading.
- Target user is beginner side-hustle swing investor, so UX must be simple and explanation-first.
- Core strategy axes only: trend, volume, support/resistance, Bollinger Band (+ optional RSI).
- Watchlist-based monitoring with 1-minute candle decision logic.
- Fixed strategy logic with limited parameter tuning (no strategy DSL).
- Signal types: Buy Candidate / Breakout / Sell Warning with weak/medium/strong levels.
- Duplicate notifications must be blocked by cooldown.
- Signal logs must be saved and reviewable.
- Mock realtime stream must work without broker API keys.
- Broker integration must be swappable via adapter interface.
- MVP excludes: auto-trading, AI prediction, heavy backtest engine, complex strategy builder.

## 2) Assumptions For Practical MVP
- Single local user mode for MVP (no auth); schema keeps user_id for future extension.
- SQLite is default local DB. PostgreSQL can be enabled by `DATABASE_URL`.
- Mock stream uses virtual market timestamps that advance by 1 minute each second, so 1-minute logic can be tested quickly.
- Desktop notification is implemented in web browser Notification API.
- Telegram notification is optional/stubbed by env values; failure does not break signal pipeline.

## 3) Architecture
- Frontend: Next.js + TypeScript + Tailwind (`apps/web`)
- Backend: FastAPI + SQLAlchemy (`services/api`)
- Realtime: backend mock stream + backend WebSocket broadcast + frontend WebSocket client

Pipeline:
1. `MarketDataProvider` (mock now, broker adapter interface ready)
2. Candle aggregation (1-minute logic)
3. Indicator engine (MA, Bollinger, volume ratio, support/resistance, RSI optional)
4. Signal engine (buy candidate / breakout / sell warning)
5. Dedup cooldown filter
6. Signal persistence + WS + optional Telegram

## 4) Delivery Steps
1. Backend project scaffold and DB models
2. Signal engine and realtime worker
3. REST and WebSocket endpoints
4. Frontend dashboard (summary, watchlist, logs, settings)
5. Env examples and README runbook
6. Sanity checks

## 5) Non-Goals (Strictly Out of MVP)
- Order placement and broker order APIs
- Free-form strategy coding
- AI model inference
- Advanced portfolio analytics
- Full backtest framework

## 6) Phase 4 Minimum-Change Plan (Realtime Chart via WS)
Scope reference: `doc/superswinghelper_roadmap_checklist.md` Phase 4

Backend lifecycle detection:
- Candle lifecycle is currently handled in `services/api/app/workers/runtime.py` using `CandleAggregator.add_tick(...)`.
- `add_tick` returns `None` while the current candle is still in-progress.
- `add_tick` returns a finalized `Candle` when minute bucket rolls over.

Where websocket candle events will be emitted:
- In `_run_loop` after each tick:
  - emit `candle_update` using the current in-progress candle (`include_current=True` last candle)
  - emit `candle_closed` when `add_tick` returns a finalized candle
- Keep existing `live` and `signal` broadcasts unchanged.

Frontend chart state update strategy:
- Keep initial REST load (`GET /api/chart/{symbol}`) as the source of full baseline state.
- In chart tab, open one WS connection while component is mounted.
- Apply only events for the selected symbol.
- `candle_update`: update last candle in-place if timestamp matches, otherwise defensively replace/append using timestamp order.
- `candle_closed`: append or replace without duplicating same timestamp.

Overlay sync strategy:
- Keep candles as source of truth in chart state.
- Recalculate MA/Bollinger/RSI overlays from current candle array on each candle event.
- Do not change backend strategy/signal logic and do not add extra API.

Safety constraints:
- No WS protocol rewrite; add only new event types.
- No new backend endpoint.
- Keep mock mode as default local validation path.
