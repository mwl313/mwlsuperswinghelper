export type SignalType = "buy_candidate" | "breakout" | "sell_warning";
export type SignalStrength = "weak" | "medium" | "strong";

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
