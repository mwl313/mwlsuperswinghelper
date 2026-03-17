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

## 7) Phase 7 Minimum-Change Plan (Candle Persistence & Backfill)
Scope reference: `doc/superswinghelper_roadmap_checklist.md` Phase 7

What will be persisted:
- Closed 1-minute candles only (not in-progress updates)
- Fields: `symbol`, `timeframe`, `timestamp`, `open`, `high`, `low`, `close`, `volume`

Where and when to write:
- Add SQLAlchemy model/table for candle history
- Runtime writes on candle close path (`add_tick` rollover result)
- Persist before/around existing candle close handling, without changing signal logic

Duplicate prevention:
- DB unique key on `(symbol, timeframe, timestamp)`
- Runtime write path uses duplicate-safe upsert-like logic (select then update/insert)

How chart API history will be assembled:
- Query persisted closed candles from DB by `symbol` + `timeframe` with `limit`
- Keep ascending order for response
- Merge current in-memory candle (if exists) from aggregator
- Deduplicate by timestamp and keep stable sorted output
- Compute overlays on merged final candle list
- Keep response contract unchanged: `candles`, `overlays`, `markers`

Range/limit behavior:
- Keep current limit-based API behavior for this phase (no complex range selector)
- Improve effective backfill depth by reading DB history instead of memory-only list

Recovery goal:
- After backend restart, previously persisted closed candles still appear via chart API
- Mock mode remains the primary local verification path

## 8) UI Polish Minimum-Change Plan (Post-Phase 7)
Scope references:
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`
- `doc/superswinghelper_roadmap_checklist.md`

Goal of this step:
- Keep current chart tab behavior and data flow
- Improve information hierarchy and trading-app-like polish
- Avoid backend/strategy changes

Minimum-change implementation points:
1. Instrument header bar (compact)
- Replace large summary style in chart tab with a dense instrument header:
  - symbol/company
  - current price / change%
  - latest signal badge
  - last update timestamp
- Keep wording beginner-friendly and non-auto-trading.

2. Compact toolbar controls
- Refactor chart controls from form-like layout into a compact toolbar:
  - symbol selector
  - RSI / marker segmented toggles
  - refresh + loading status

3. Chart prominence and cleaner panels
- Make price chart the visual center with larger, cleaner card treatment.
- Keep volume and optional RSI in separate lightweight panels below.
- Keep signal explanations outside the candlestick plot area.

4. Reduce chart noise
- Use shorter marker text on chart (minimal labels/icons)
- Keep full signal reason in a separate “최근 신호 설명” panel
- So price action remains readable even with markers enabled.

5. Consistent visual system (frontend-only)
- Unify neutral background, panel border, subtle shadow, spacing rhythm
- Keep existing tab navigation and app-level behavior unchanged

Files to touch (expected):
- `apps/web/components/chart/ChartSection.tsx`
- `apps/web/components/chart/ChartControls.tsx`
- `apps/web/components/chart/CandlestickChart.tsx`
- `apps/web/components/chart/VolumeChart.tsx`
- `apps/web/app/globals.css`
- `README.md` (short note for UI polish)

## 9) Phase 8 Minimum-Change Plan (Real KIS Provider Integration)
Scope reference: `doc/superswinghelper_roadmap_checklist.md` Phase 8

Goal:
- Keep existing runtime/chart/signal pipeline
- Swap market data source between `mock` and `kis` by config
- Add real KIS auth + quote polling + intraday history fetch

Integration points:
1. Provider contract extension
- Extend `MarketDataProvider` with a history method for chart/bootstrap:
  - `get_recent_candles(symbol, limit)`
- Keep `get_ticks(symbols)` as the live ingestion interface.

2. KIS adapter implementation (minimal reliable path)
- Implement OAuth token acquisition/refresh (`/oauth2/tokenP`)
- Implement real quote retrieval for live polling (`/uapi/.../inquire-price`)
- Implement intraday candle retrieval for initial history (`/uapi/.../inquire-time-itemchartprice`)
- Parse response defensively because KIS field names can vary by environment.

3. Runtime bootstrap for chart history
- Before normal tick loop, for newly watched symbols:
  - try provider history fetch
  - upsert candles into `candles_1m`
  - seed aggregator closed-candle history
- This keeps:
  - chart REST initial load quality
  - signal engine warm-up quality
  - existing websocket flow unchanged

4. Keep mock mode intact
- `MockMarketDataProvider` keeps existing behavior and returns empty history bootstrap.
- Provider selection remains `MARKET_DATA_PROVIDER=mock|kis`.

5. Config and docs
- Add KIS-focused env vars (base URL, poll interval, TR IDs, history seed limit).
- Document:
  - required keys
  - mock vs kis switching
  - limitations (polling-based live for MVP, no order execution)
