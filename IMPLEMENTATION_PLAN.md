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

## 10) Position Layer Minimum-Change Plan (Watchlist-Centric UI + Separate Model)
Scope references:
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`
- `doc/superswinghelper_roadmap_checklist.md`
- `doc/superswinghelper_position_layer_design.md` (primary)

Goal:
- Add manual position layer without separate tab
- Keep watchlist as main entry point
- Keep position data model separated from watchlist model

Implementation steps:
1. Backend model/service
- Add `Position` model (single open position per symbol/user).
- Add position service for:
  - upsert (holding/not_holding)
  - close
  - symbol summary/PnL calculation

2. Backend API integration
- Add minimal position endpoints:
  - `GET /api/positions`
  - `GET /api/positions/{symbol}`
  - `PATCH /api/positions/{symbol}`
  - `POST /api/positions/{symbol}/close`
- Extend watchlist add payload to require `holding_state` and `entry_price` when holding.
- Keep existing watchlist features intact.

3. Dashboard/live payload extension
- Extend `watchlist/live` response with per-symbol position summary
  (`holding_state`, `entry_price`, optional quantity/stop/take/note, pnl values).

4. Frontend watchlist integration
- Extend add form:
  - required holding/not_holding selection
  - required entry price if holding
  - optional quantity/stop/take/note
- Show position summary columns in watchlist.
- Add modal-based position editor per symbol.

5. Frontend chart integration
- Show compact selected-symbol position summary panel in chart tab.
- Add “포지션 수정” entry point from chart tab using same modal flow.

6. Verification/docs
- Add tests for position service behavior.
- Update README with model/API/flow changes and intentionally excluded scope.

## 11) Chart Readability Minimum-Change Plan (Legend + Toggles + Timeframe)
Scope references:
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`
- `doc/superswinghelper_roadmap_checklist.md`

Goal:
- Improve chart readability for beginner users without changing strategy/broker scope.
- Keep chart data contract stable while adding timeframe query support.

Backend minimum changes:
1. Add chart timeframe query support in `GET /api/chart/{symbol}`:
- allowed: `1m`, `5m`, `15m`, `1h`
2. Keep `1m` as canonical source:
- read persisted closed `1m` candles + current in-memory `1m` candle
- aggregate to requested timeframe in chart service layer
3. Aggregation policy:
- open=first, high=max, low=min, close=last, volume=sum
4. Compute overlays on aggregated candles.
5. Keep markers shape unchanged; filter by chart start timestamp.
6. Add/adjust tests for timeframe aggregation behavior.

Frontend minimum changes:
1. Add timeframe selector UI in chart controls.
2. Add compact legend/color key near chart with active/inactive states.
3. Make legend/toggle controls functional for:
- Candles, MA20, MA60, Bollinger, Signal markers, RSI, Volume
4. Keep 1m websocket live update behavior.
5. For higher timeframes, keep simple behavior:
- reload API on candle close or timeframe switch (no multi-timeframe WS stream rewrite)
6. Improve candle readability:
- avoid full fit-to-all on first load
- show recent range by default
- keep clearer candle body/wick visibility and compact grid style

Out of scope in this phase:
- new indicators
- strategy engine changes
- broker execution/account features
- major UI re-architecture

## 12) Provider Settings Minimum-Change Plan (UI KIS Credentials + Mode Control)
Scope references:
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`
- `doc/superswinghelper_roadmap_checklist.md`

Goal:
- In settings tab, allow private users to enter KIS credentials, save server-side, test connection, and switch provider mode (`mock`/`kis`) safely.

Backend plan:
1. Add server-side system config persistence model (single-row):
- provider mode
- KIS app key/secret
- optional base URL
2. Add system endpoints:
- `GET /api/system/provider-status`
- `POST /api/system/kis-credentials`
- `PATCH /api/system/provider-mode`
- `POST /api/system/provider-test`
3. Extend runtime:
- load provider mode/credentials from persisted config
- expose provider health/status (`lastError`, `lastUpdateAt`)
- safe runtime switch (`stop -> rebuild provider -> start`)
- reject switching to `kis` when credentials are missing
- run KIS connection test using server-stored credentials
4. Never return raw secret in response; return only booleans/safe status.

Frontend plan:
1. Settings tab cards:
- Provider status card (mode, configured, health, last error/update)
- KIS credentials card with strong red warning box
- Provider controls card (test + switch)
2. Credential save behavior:
- send to backend
- clear secret input after success
- refresh status
3. Disable `KIS test` and `Switch to KIS` until configured.
4. Keep existing strategy settings form and flows unchanged.

Security handling (private-use baseline):
- no localStorage for credentials
- no plaintext secret echo from backend
- server-side persistence only

## 13) Position Layer Recovery Minimum-Change Plan
Scope references:
- `README.md` (existing frontend/API expectations)
- `doc/kospi_swing_signal_spec_beginner_side_hustle.md`
- `doc/superswinghelper_roadmap_checklist.md`

Current gap summary:
- Frontend types/API already expect position fields and `/positions` endpoints.
- Backend currently has no `Position` model/service/router.
- `watchlist` add payload and `/watchlist/live` response are not position-aware yet.

Recovery strategy (minimal-change):
1. Backend data model and schemas
- Add `Position` model with one row per `(user_id, symbol)` and open/closed state.
- Enforce required rules:
  - `holding_state` required
  - when `holding`: `entry_price` and integer `quantity` required
  - optional stop/take values must be `> 0` if provided
- Add `position` schemas and extend watchlist/dashboard schemas accordingly.

2. Backend service and API
- Add `services/positions.py` for:
  - upsert/close/get/list
  - `pnl_percent` / `pnl_amount` calculation from current price
  - default not-holding summary construction
- Add routes:
  - `GET /api/positions`
  - `GET /api/positions/{symbol}`
  - `PATCH /api/positions/{symbol}`
  - `POST /api/positions/{symbol}/close`
- Extend `POST /api/watchlists/{id}/items` to accept holding payload and create/close position.
- Extend `/api/watchlist/live` to include position summary fields for each row.

3. Frontend recovery
- Watchlist add form:
  - require `보유여부`
  - if `보유중`: require `진입가` + integer `수량`
  - include optional stop/take/note
- Add reusable position edit modal (watchlist row + chart tab entry shared).
- Show compact position summary in watchlist rows and keep chart summary synced.
- Wire chart `onOpenPositionEditor(symbol)` to open same modal directly.

4. Verification and docs
- Add backend tests for position service validation/upsert/close/pnl.
- Keep existing chart/signal/provider behavior unchanged.
- Update README position section to match restored validation rules and flows.

## 14) Symbol Code + Name Search Minimum-Change Plan
Scope references:
- `README.md`
- `apps/web/app/page.tsx`
- `apps/web/lib/api.ts`
- `services/api/app/api/symbols.py`
- `services/api/app/services/symbol_lookup.py`

Goal:
- Keep canonical watchlist storage as 6-digit symbol code.
- Extend UX so users can search/add by code or Korean stock name.

Backend plan:
1. Keep `GET /api/symbols/resolve` unchanged.
2. Add `GET /api/symbols/search?q=...&limit=...`.
3. Reuse existing KRX file-map + fallback map + watchlist DB names.
4. Return compact rows: `symbol`, `symbol_name`, `market`, `source`.
5. Keep deterministic ranking:
- exact code > code prefix > exact/startswith/contains name.

Frontend plan:
1. Change watchlist add input to text query (`종목코드 또는 종목명`).
2. Add suggestion list and explicit selection UX.
3. Keep exact 6-digit code path via `resolve`.
4. Use new search API for name/partial queries.
5. Submit only selected canonical code + name.
6. Disable add until symbol is selected and holding validations pass.

## 15) Historical Backfill / Older Continuation Minimum-Change Plan
Scope references:
- `services/api/app/api/chart.py`
- `services/api/app/services/chart_data.py`
- `services/api/app/workers/runtime.py`
- `services/api/app/services/market_data/kis_adapter.py`
- `apps/web/components/chart/ChartSection.tsx`

Goal:
- Extend chart history left side without changing canonical model.
- Keep `1m` persisted candles as source of truth and aggregate higher frames from `1m`.

Backend plan:
1. Add chart API `before` query parameter.
2. Query persisted candles older than `before` (exclusive), still ascending in response.
3. Keep overlays computed from final returned candle slice.
4. Keep current in-memory candle merge only for newest page (`before` absent).
5. Extend KIS history seed to multi-chunk backfill using `before` cursor and upsert into `candles_1m`.
6. Keep duplicate-safe storage by existing unique key and upsert behavior.

Frontend plan:
1. Add `이전 데이터 더 보기` action in chart panel.
2. Request older chunk via `GET /api/chart/{symbol}?before=...`.
3. Prepend older candles, dedupe by timestamp, keep ascending order.
4. Recompute overlays on merged candles and preserve current live update path.
5. Keep timeframe selector and websocket behavior unchanged.
