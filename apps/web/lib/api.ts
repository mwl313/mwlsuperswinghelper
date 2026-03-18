import {
  ChartResponse,
  DashboardSummary,
  KisCredentialsPayload,
  KisCredentialsSaveResult,
  LiveWatchlistItem,
  PositionSummary,
  PositionUpsertPayload,
  ProviderConnectionTestResult,
  ProviderMode,
  ProviderStatus,
  SignalBulkDeleteResult,
  SignalDeleteOneResult,
  SignalLog,
  SymbolSearchResult,
  StrategySettings,
  SymbolResolveResult,
  Watchlist,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

function getDefaultWsUrl(): string {
  if (typeof window !== "undefined") {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${window.location.host}/ws/live-signals`;
  }
  return "ws://127.0.0.1:8000/ws/live-signals";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}

export function getWatchlists() {
  return request<Watchlist[]>("/watchlists");
}

export function getLiveWatchlist() {
  return request<LiveWatchlistItem[]>("/watchlist/live");
}

export function addWatchlistItem(
  watchlistId: number,
  payload: {
    symbol: string;
    symbol_name?: string;
    enabled: boolean;
    holding_state: "not_holding" | "holding";
    entry_price?: number | null;
    quantity?: number | null;
    stop_loss_price?: number | null;
    take_profit_price?: number | null;
    note?: string | null;
  }
) {
  return request(`/watchlists/${watchlistId}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateWatchlistItem(itemId: number, enabled: boolean) {
  return request(`/watchlists/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function deleteWatchlistItem(watchlistId: number, itemId: number) {
  return request(`/watchlists/${watchlistId}/items/${itemId}`, { method: "DELETE" });
}

export function getSignals(limit = 100) {
  return request<SignalLog[]>(`/signals?limit=${limit}`);
}

export function deleteSignals(symbol?: string) {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  return request<SignalBulkDeleteResult>(`/signals${query}`, { method: "DELETE" });
}

export function deleteSignal(id: number) {
  return request<SignalDeleteOneResult>(`/signals/${id}`, { method: "DELETE" });
}

export function getSettings() {
  return request<StrategySettings>("/settings");
}

export function resolveSymbol(symbol: string) {
  return request<SymbolResolveResult>(`/symbols/resolve?symbol=${symbol}`);
}

export function searchSymbols(query: string, limit = 10) {
  return request<SymbolSearchResult[]>(`/symbols/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export function updateSettings(payload: Omit<StrategySettings, "id" | "user_id" | "created_at" | "updated_at">) {
  return request<StrategySettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getChart(symbol: string, limit = 240, timeframe: "1m" | "5m" | "15m" | "1h" = "1m", before?: string) {
  const beforeQuery = before ? `&before=${encodeURIComponent(before)}` : "";
  return request<ChartResponse>(`/chart/${symbol}?limit=${limit}&timeframe=${timeframe}${beforeQuery}`);
}

export function getPositions() {
  return request<PositionSummary[]>("/positions");
}

export function getPosition(symbol: string) {
  return request<PositionSummary>(`/positions/${symbol}`);
}

export function updatePosition(symbol: string, payload: PositionUpsertPayload) {
  return request<PositionSummary>(`/positions/${symbol}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function closePosition(symbol: string) {
  return request<PositionSummary>(`/positions/${symbol}/close`, {
    method: "POST",
  });
}

export function getProviderStatus() {
  return request<ProviderStatus>("/system/provider-status");
}

export function saveKisCredentials(payload: KisCredentialsPayload) {
  return request<KisCredentialsSaveResult>("/system/kis-credentials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function switchProviderMode(mode: ProviderMode) {
  return request<ProviderStatus>("/system/provider-mode", {
    method: "PATCH",
    body: JSON.stringify({ mode }),
  });
}

export function testProviderConnection() {
  return request<ProviderConnectionTestResult>("/system/provider-test", {
    method: "POST",
  });
}

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || getDefaultWsUrl();
