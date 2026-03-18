"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ChartSection } from "@/components/chart/ChartSection";
import { SummarySection } from "@/components/dashboard/SummarySection";
import { AppTabKey, AppTabs } from "@/components/layout/AppTabs";
import { SettingsSection, type EditableStrategySettings, type KisCredentialFormState } from "@/components/settings/SettingsSection";
import { SignalsSection } from "@/components/signals/SignalsSection";
import { WatchlistSection } from "@/components/watchlist/WatchlistSection";
import {
  WS_URL,
  addWatchlistItem,
  deleteWatchlistItem,
  getProviderStatus,
  getLiveWatchlist,
  getSettings,
  getSignals,
  getSummary,
  getWatchlists,
  resolveSymbol,
  saveKisCredentials,
  switchProviderMode,
  testProviderConnection,
  updateSettings,
  updateWatchlistItem,
} from "@/lib/api";
import {
  DashboardSummary,
  LiveSignalEvent,
  LiveWatchlistItem,
  ProviderMode,
  ProviderStatus,
  SignalLog,
  SignalType,
  StrategySettings,
  Watchlist,
  WatchlistItem,
} from "@/lib/types";

const signalTypeText: Record<SignalType, string> = {
  buy_candidate: "매수 후보",
  breakout: "돌파 감시",
  sell_warning: "매도 경고",
};

const EMPTY_SUMMARY: DashboardSummary = {
  market_status: "loading",
  today_signal_count: 0,
  strong_signal_count: 0,
  strong_symbols: [],
  watchlist_total: 0,
  watchlist_enabled: 0,
};

const TABS: { key: AppTabKey; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "watchlist", label: "워치리스트" },
  { key: "chart", label: "차트" },
  { key: "signals", label: "시그널" },
  { key: "settings", label: "설정" },
];

const EMPTY_KIS_FORM: KisCredentialFormState = {
  appKey: "",
  appSecret: "",
  baseUrl: "",
};

function asEditableSettings(settings: StrategySettings): EditableStrategySettings {
  const { id, user_id, created_at, updated_at, ...rest } = settings;
  return rest;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AppTabKey>("overview");
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [liveRows, setLiveRows] = useState<LiveWatchlistItem[]>([]);
  const [signals, setSignals] = useState<SignalLog[]>([]);
  const [settings, setSettings] = useState<StrategySettings | null>(null);
  const [formSettings, setFormSettings] = useState<EditableStrategySettings | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(false);
  const [providerActionLoading, setProviderActionLoading] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [kisForm, setKisForm] = useState<KisCredentialFormState>(EMPTY_KIS_FORM);
  const [newSymbol, setNewSymbol] = useState("");
  const [resolvedSymbolName, setResolvedSymbolName] = useState<string | null>(null);
  const [isResolvingSymbol, setIsResolvingSymbol] = useState(false);
  const [symbolLookupMessage, setSymbolLookupMessage] = useState("6자리 종목코드를 입력하세요.");
  const [error, setError] = useState<string | null>(null);

  const currentWatchlist = watchlists[0] ?? null;

  const watchlistItemMap = useMemo(() => {
    const map = new Map<string, WatchlistItem>();
    if (currentWatchlist) {
      currentWatchlist.items.forEach((item) => map.set(item.symbol, item));
    }
    return map;
  }, [currentWatchlist]);

  const chartSymbols = useMemo(
    () =>
      currentWatchlist?.items.map((item) => ({
        symbol: item.symbol,
        symbol_name: item.symbol_name,
      })) ?? [],
    [currentWatchlist]
  );

  const liveRowMap = useMemo(() => {
    return new Map(liveRows.map((row) => [row.symbol, row]));
  }, [liveRows]);

  const latestSignalMap = useMemo(() => {
    const map = new Map<string, SignalLog>();
    for (const row of signals) {
      if (!map.has(row.symbol)) {
        map.set(row.symbol, row);
      }
    }
    return map;
  }, [signals]);

  useEffect(() => {
    if (chartSymbols.length === 0) {
      setSelectedChartSymbol(null);
      return;
    }
    if (!selectedChartSymbol || !chartSymbols.some((row) => row.symbol === selectedChartSymbol)) {
      setSelectedChartSymbol(chartSymbols[0].symbol);
    }
  }, [chartSymbols, selectedChartSymbol]);

  async function refreshStatic() {
    try {
      const [summaryData, watchlistsData, signalsData] = await Promise.all([getSummary(), getWatchlists(), getSignals(120)]);
      setSummary(summaryData);
      setWatchlists(watchlistsData);
      setSignals(signalsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로드 실패");
    }
  }

  async function refreshLive() {
    try {
      const rows = await getLiveWatchlist();
      setLiveRows(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "실시간 데이터 로드 실패");
    }
  }

  async function refreshSettings() {
    try {
      const data = await getSettings();
      setSettings(data);
      setFormSettings(asEditableSettings(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정 로드 실패");
    }
  }

  async function refreshProviderStatus(showLoading = false) {
    if (showLoading) {
      setProviderStatusLoading(true);
    }
    try {
      const status = await getProviderStatus();
      setProviderStatus(status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provider 상태 조회 실패");
    } finally {
      if (showLoading) {
        setProviderStatusLoading(false);
      }
    }
  }

  useEffect(() => {
    void refreshStatic();
    void refreshLive();
    void refreshSettings();
    void refreshProviderStatus(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshStatic();
      void refreshLive();
      if (activeTab === "settings") {
        void refreshProviderStatus(false);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "settings") {
      void refreshProviderStatus(true);
    }
  }, [activeTab]);

  useEffect(() => {
    const sanitized = newSymbol.replace(/\D/g, "").slice(0, 6);
    if (sanitized !== newSymbol) {
      setNewSymbol(sanitized);
      return;
    }

    if (sanitized.length < 6) {
      setResolvedSymbolName(null);
      setIsResolvingSymbol(false);
      setSymbolLookupMessage("6자리 종목코드를 입력하세요.");
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setIsResolvingSymbol(true);
      try {
        const resolved = await resolveSymbol(sanitized);
        if (!active) return;
        if (resolved.found && resolved.symbol_name) {
          setResolvedSymbolName(resolved.symbol_name);
          setSymbolLookupMessage(`종목명: ${resolved.symbol_name}`);
        } else {
          setResolvedSymbolName(null);
          setSymbolLookupMessage("종목코드를 찾지 못했습니다. 코드를 다시 확인해주세요.");
        }
      } catch {
        if (!active) return;
        setResolvedSymbolName(null);
        setSymbolLookupMessage("종목명 조회 중 오류가 발생했습니다.");
      } finally {
        if (active) setIsResolvingSymbol(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [newSymbol]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; data?: LiveSignalEvent | LiveWatchlistItem };
        if (payload.type === "signal" && payload.data) {
          const incoming = payload.data as LiveSignalEvent;
          setSignals((prev) => [incoming as SignalLog, ...prev].slice(0, 120));

          if (settings?.enable_desktop_notifications && typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification(`${signalTypeText[incoming.signal_type]}: ${incoming.symbol_name}`, {
                body: incoming.reason_text,
              });
            }
          }
        }

        if (payload.type === "live" && payload.data) {
          const incoming = payload.data as LiveWatchlistItem;
          setLiveRows((prev) => {
            const next = [...prev];
            const idx = next.findIndex((row) => row.symbol === incoming.symbol);
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...incoming };
            } else {
              next.push(incoming);
            }
            return next;
          });
        }
      } catch {
        // ignore malformed ws payload
      }
    };

    return () => ws.close();
  }, [settings?.enable_desktop_notifications]);

  async function onAddSymbol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentWatchlist) return;
    if (newSymbol.length !== 6) {
      setError("6자리 종목코드를 입력해주세요.");
      return;
    }
    try {
      await addWatchlistItem(currentWatchlist.id, {
        symbol: newSymbol.trim(),
        enabled: true,
        holding_state: "not_holding",
      });
      await refreshStatic();
      await refreshLive();
      setNewSymbol("");
      setResolvedSymbolName(null);
      setSymbolLookupMessage("6자리 종목코드를 입력하세요.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "종목 추가 실패");
    }
  }

  async function onToggleItem(item: WatchlistItem) {
    try {
      await updateWatchlistItem(item.id, !item.enabled);
      await refreshStatic();
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "감시 상태 변경 실패");
    }
  }

  async function onDeleteItem(item: WatchlistItem) {
    if (!currentWatchlist) return;
    try {
      await deleteWatchlistItem(currentWatchlist.id, item.id);
      await refreshStatic();
      await refreshLive();
    } catch (e) {
      setError(e instanceof Error ? e.message : "종목 삭제 실패");
    }
  }

  async function onSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formSettings) return;
    try {
      const updated = await updateSettings(formSettings);
      setSettings(updated);
      setFormSettings(asEditableSettings(updated));
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정 저장 실패");
    }
  }

  async function onEnableDesktopAlert() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    await Notification.requestPermission();
  }

  async function onSaveKisCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!kisForm.appKey.trim() || !kisForm.appSecret.trim()) {
      setProviderMessage("App Key와 App Secret을 모두 입력하세요.");
      return;
    }

    setProviderActionLoading(true);
    try {
      const result = await saveKisCredentials({
        appKey: kisForm.appKey.trim(),
        appSecret: kisForm.appSecret.trim(),
        baseUrl: kisForm.baseUrl.trim() || undefined,
      });
      setProviderMessage(result.ok ? "KIS 자격증명을 서버에 저장했습니다." : "KIS 자격증명 저장 실패");
      setKisForm((prev) => ({ ...prev, appKey: "", appSecret: "" }));
      await refreshProviderStatus();
    } catch (e) {
      setProviderMessage(e instanceof Error ? e.message : "KIS 자격증명 저장 실패");
    } finally {
      setProviderActionLoading(false);
    }
  }

  async function onSwitchProviderMode(mode: ProviderMode) {
    setProviderActionLoading(true);
    try {
      const status = await switchProviderMode(mode);
      setProviderStatus(status);
      setProviderMessage(`Provider 모드를 ${mode.toUpperCase()}로 전환했습니다.`);
    } catch (e) {
      setProviderMessage(e instanceof Error ? e.message : "Provider 모드 전환 실패");
    } finally {
      setProviderActionLoading(false);
    }
  }

  async function onTestProviderConnection() {
    setProviderActionLoading(true);
    try {
      const result = await testProviderConnection();
      setProviderMessage(result.message);
      await refreshProviderStatus();
    } catch (e) {
      setProviderMessage(e instanceof Error ? e.message : "KIS 연결 테스트 실패");
    } finally {
      setProviderActionLoading(false);
    }
  }

  function onOpenChart(symbol: string) {
    setSelectedChartSymbol(symbol);
    setActiveTab("chart");
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4 pb-10 md:p-8">
      <AppTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {error ? <p className="mb-4 text-sm text-[#a4302d]">오류: {error}</p> : null}

      {activeTab === "overview" ? (
        <SummarySection summary={summary} error={null} onEnableDesktopAlert={onEnableDesktopAlert} />
      ) : null}

      {activeTab === "watchlist" ? (
        <WatchlistSection
          liveRows={liveRows}
          watchlistItemMap={watchlistItemMap}
          newSymbol={newSymbol}
          resolvedSymbolName={resolvedSymbolName}
          isResolvingSymbol={isResolvingSymbol}
          symbolLookupMessage={symbolLookupMessage}
          onSymbolChange={setNewSymbol}
          onAddSymbol={onAddSymbol}
          onToggleItem={onToggleItem}
          onDeleteItem={onDeleteItem}
          onOpenChart={onOpenChart}
        />
      ) : null}

      {activeTab === "chart" ? (
        <ChartSection
          symbols={chartSymbols}
          selectedSymbol={selectedChartSymbol}
          onSelectSymbol={setSelectedChartSymbol}
          liveQuote={selectedChartSymbol ? (liveRowMap.get(selectedChartSymbol) ?? null) : null}
          recentSignal={selectedChartSymbol ? (latestSignalMap.get(selectedChartSymbol) ?? null) : null}
          onOpenPositionEditor={() => {
            setActiveTab("watchlist");
          }}
        />
      ) : null}
      {activeTab === "signals" ? <SignalsSection signals={signals} /> : null}
      {activeTab === "settings" ? (
        <SettingsSection
          formSettings={formSettings}
          onChange={setFormSettings}
          onSave={onSaveSettings}
          providerStatus={providerStatus}
          providerStatusLoading={providerStatusLoading}
          providerActionLoading={providerActionLoading}
          providerMessage={providerMessage}
          kisForm={kisForm}
          onKisFormChange={setKisForm}
          onSaveKisCredentials={onSaveKisCredentials}
          onSwitchProviderMode={onSwitchProviderMode}
          onTestProviderConnection={onTestProviderConnection}
        />
      ) : null}
    </main>
  );
}
