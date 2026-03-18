export type SignalType = "buy_candidate" | "breakout" | "sell_warning";
export type SignalStrength = "weak" | "medium" | "strong";
export type HoldingState = "not_holding" | "holding";

export type DashboardSummary = {
  market_status: string;
  today_signal_count: number;
  strong_signal_count: number;
  strong_symbols: string[];
  watchlist_total: number;
  watchlist_enabled: number;
};

export type WatchlistItem = {
  id: number;
  symbol: string;
  symbol_name: string;
  enabled: boolean;
  created_at: string;
};

export type Watchlist = {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  items: WatchlistItem[];
};

export type LiveWatchlistItem = {
  symbol: string;
  symbol_name: string;
  enabled: boolean;
  price: number | null;
  change_percent: number | null;
  last_signal_type: SignalType | null;
  last_signal_strength: SignalStrength | null;
  last_signal_reason: string | null;
  holding_state: HoldingState;
  entry_price: number | null;
  quantity: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  note: string | null;
  pnl_percent: number | null;
  pnl_amount: number | null;
};

export type SignalLog = {
  id: number;
  symbol: string;
  symbol_name: string;
  signal_type: SignalType;
  signal_strength: SignalStrength;
  price: number;
  volume: number;
  reason_text: string;
  raw_payload_json: Record<string, unknown>;
  created_at: string;
};

export type StrategySettings = {
  id: number;
  user_id: number;
  ma_short: number;
  ma_long: number;
  bollinger_length: number;
  bollinger_std: number;
  volume_multiplier: number;
  use_rsi: boolean;
  use_breakout: boolean;
  use_bollinger_support: boolean;
  use_trend_filter: boolean;
  use_volume_surge: boolean;
  signal_strength_mode: "all" | "strong_only";
  cooldown_minutes: number;
  enable_desktop_notifications: boolean;
  enable_telegram_notifications: boolean;
  created_at: string;
  updated_at: string;
};

export type LiveSignalEvent = {
  id?: number;
  symbol: string;
  symbol_name: string;
  signal_type: SignalType;
  signal_strength: SignalStrength;
  price: number;
  volume: number;
  reason_text: string;
  created_at: string;
};

export type SymbolResolveResult = {
  symbol: string;
  symbol_name: string | null;
  found: boolean;
  source: string;
};

export type ChartCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartOverlayPoint = {
  timestamp: string;
  value: number;
};

export type ChartOverlays = {
  ma20: ChartOverlayPoint[];
  ma60: ChartOverlayPoint[];
  bollinger_upper: ChartOverlayPoint[];
  bollinger_mid: ChartOverlayPoint[];
  bollinger_lower: ChartOverlayPoint[];
  rsi14: ChartOverlayPoint[];
};

export type ChartMarker = {
  timestamp: string;
  type: SignalType;
  strength: SignalStrength;
  title: string;
  description: string;
};

export type ChartResponse = {
  symbol: string;
  timeframe: "1m" | "5m" | "15m" | "1h";
  candles: ChartCandle[];
  overlays: ChartOverlays;
  markers: ChartMarker[];
};

export type CandleEventType = "candle_update" | "candle_closed";

export type CandleWsEvent = {
  type: CandleEventType;
  symbol: string;
  timeframe: "1m";
  candle: ChartCandle;
};

export type PositionSummary = {
  symbol: string;
  symbol_name: string;
  holding_state: HoldingState;
  status: "open" | "closed" | null;
  entry_price: number | null;
  quantity: number | null;
  stop_loss_price: number | null;
  take_profit_price: number | null;
  note: string | null;
  opened_at: string | null;
  closed_at: string | null;
  updated_at: string | null;
  pnl_percent: number | null;
  pnl_amount: number | null;
};

export type PositionUpsertPayload = {
  holding_state: HoldingState;
  symbol_name?: string | null;
  entry_price?: number | null;
  quantity?: number | null;
  stop_loss_price?: number | null;
  take_profit_price?: number | null;
  note?: string | null;
};

export type ProviderMode = "mock" | "kis";

export type ProviderStatus = {
  mode: ProviderMode;
  kisConfigured: boolean;
  runtimeHealthy: boolean;
  lastError: string | null;
  lastUpdateAt: string | null;
  supportsSwitching: boolean;
  lastSwitchAt: string | null;
  hasAppKey: boolean;
  hasAppSecret: boolean;
};

export type KisCredentialsPayload = {
  appKey: string;
  appSecret: string;
  baseUrl?: string | null;
};

export type KisCredentialsSaveResult = {
  ok: boolean;
  kisConfigured: boolean;
  hasAppKey: boolean;
  hasAppSecret: boolean;
  baseUrlSet: boolean;
  updatedAt: string;
};

export type ProviderConnectionTestResult = {
  ok: boolean;
  mode: ProviderMode;
  message: string;
  testedAt: string;
};
