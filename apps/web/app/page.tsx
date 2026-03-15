"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { SignalPill } from "@/components/SignalPill";
import {
  WS_URL,
  addWatchlistItem,
  deleteWatchlistItem,
  getLiveWatchlist,
  getSettings,
  getSignals,
  getSummary,
  getWatchlists,
  resolveSymbol,
  updateSettings,
  updateWatchlistItem,
} from "@/lib/api";
import {
  DashboardSummary,
  LiveSignalEvent,
  LiveWatchlistItem,
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

function numberFormat(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function asEditableSettings(settings: StrategySettings) {
  const { id, user_id, created_at, updated_at, ...rest } = settings;
  return rest;
}

export default function HomePage() {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [liveRows, setLiveRows] = useState<LiveWatchlistItem[]>([]);
  const [signals, setSignals] = useState<SignalLog[]>([]);
  const [settings, setSettings] = useState<StrategySettings | null>(null);
  const [formSettings, setFormSettings] = useState<ReturnType<typeof asEditableSettings> | null>(null);
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

  useEffect(() => {
    void refreshStatic();
    void refreshLive();
    void refreshSettings();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshStatic();
      void refreshLive();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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

  return (
    <main className="mx-auto w-full max-w-7xl p-4 pb-10 md:p-8">
      <header className="card pulse mb-6 p-5 md:p-6">
        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-[#8a6d48]">KOSPI Swing Signal MVP</p>
        <h1 className="mb-2 text-2xl font-bold md:text-3xl">초보 부업 투자자를 위한 신호 대시보드</h1>
        <p className="text-sm text-[#496466]">
          이 앱은 자동매매가 아닌 참고용 시그널 알림기입니다. 신호 이유를 확인하고 최종 판단은 직접 진행하세요.
        </p>
        {error ? <p className="mt-2 text-sm text-[#a4302d]">오류: {error}</p> : null}
      </header>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">장 상태</p>
          <p className="mt-2 text-xl font-bold">{summary.market_status}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">오늘 알림 수</p>
          <p className="mt-2 text-xl font-bold">{summary.today_signal_count}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">강한 신호</p>
          <p className="mt-2 text-xl font-bold">{summary.strong_signal_count}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">감시 종목</p>
          <p className="mt-2 text-xl font-bold">{summary.watchlist_enabled} / {summary.watchlist_total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[#7a6a51]">강한 신호 종목</p>
          <p className="mt-2 text-sm font-semibold">{summary.strong_symbols.join(", ") || "없음"}</p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">워치리스트</h2>
            <p className="text-xs text-[#7a6a51]">종목별 최근 신호와 감시 상태</p>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#d4c4aa] text-xs text-[#7a6a51]">
                  <th className="pb-2">종목</th>
                  <th className="pb-2">현재가</th>
                  <th className="pb-2">변동률</th>
                  <th className="pb-2">최근 신호</th>
                  <th className="pb-2">감시</th>
                  <th className="pb-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row) => {
                  const item = watchlistItemMap.get(row.symbol);
                  return (
                    <tr key={row.symbol} className="border-b border-[#eadcc8] align-top">
                      <td className="py-2">
                        <div className="font-semibold">{row.symbol_name}</div>
                        <div className="text-xs text-[#7a6a51]">{row.symbol}</div>
                      </td>
                      <td className="py-2">{numberFormat(row.price)}</td>
                      <td className={`py-2 ${row.change_percent && row.change_percent < 0 ? "text-[#a4302d]" : "text-[#1f7a59]"}`}>
                        {row.change_percent !== null ? `${row.change_percent.toFixed(2)}%` : "-"}
                      </td>
                      <td className="py-2">
                        {row.last_signal_type && row.last_signal_strength ? (
                          <div className="space-y-1">
                            <SignalPill type={row.last_signal_type} strength={row.last_signal_strength} />
                            <p className="max-w-[340px] text-xs text-[#496466]">{row.last_signal_reason}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-[#7a6a51]">최근 신호 없음</span>
                        )}
                      </td>
                      <td className="py-2">{item?.enabled ? "ON" : "OFF"}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          {item ? (
                            <>
                              <button
                                className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs"
                                onClick={() => void onToggleItem(item)}
                              >
                                {item.enabled ? "감시 끄기" : "감시 켜기"}
                              </button>
                              <button
                                className="rounded-md border border-[#c9b89c] px-2 py-1 text-xs"
                                onClick={() => void onDeleteItem(item)}
                              >
                                삭제
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={onAddSymbol}>
            <input
              className="rounded-md border border-[#c9b89c] bg-white px-3 py-2 text-sm"
              placeholder="종목코드"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
            />
            <button
              className="rounded-md bg-[#113c3a] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#6b8f8d]"
              disabled={isResolvingSymbol || newSymbol.length !== 6 || !resolvedSymbolName}
            >
              종목 추가
            </button>
          </form>
          <p className={`mt-2 text-xs ${resolvedSymbolName ? "text-[#1f7a59]" : "text-[#7a6a51]"}`}>
            {isResolvingSymbol ? "종목명 확인 중..." : symbolLookupMessage}
          </p>
        </div>

        <div className="space-y-4">
          <div className="card p-4 md:p-5">
            <h2 className="mb-2 text-lg font-bold">용어 도움말</h2>
            <ul className="space-y-2 text-sm">
              <li><b>매수 후보</b>: 추세/거래량/지지 조건이 맞아 관심 있게 볼 구간</li>
              <li><b>돌파 감시</b>: 최근 저항선을 넘어서는지 확인할 구간</li>
              <li><b>매도 경고</b>: 추세 약화 또는 지지 이탈로 리스크가 커진 구간</li>
            </ul>
          </div>
          <div className="card p-4 md:p-5">
            <h2 className="mb-2 text-lg font-bold">알림 안내</h2>
            <p className="mb-3 text-sm text-[#496466]">
              같은 종목의 같은 신호는 쿨다운 시간 동안 중복 알림이 제한됩니다.
            </p>
            <button className="rounded-md border border-[#c9b89c] px-3 py-2 text-sm" onClick={() => void onEnableDesktopAlert()}>
              브라우저 알림 권한 요청
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <form className="card p-4 md:p-5" onSubmit={onSaveSettings}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">설정</h2>
            <p className="text-xs text-[#7a6a51]">전략식 직접 입력 없이 파라미터만 조정</p>
          </div>

          {formSettings ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                단기 MA
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.ma_short}
                  onChange={(e) => setFormSettings({ ...formSettings, ma_short: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                장기 MA
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.ma_long}
                  onChange={(e) => setFormSettings({ ...formSettings, ma_long: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                볼린저 길이
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.bollinger_length}
                  onChange={(e) => setFormSettings({ ...formSettings, bollinger_length: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                볼린저 표준편차
                <input
                  type="number"
                  step="0.1"
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.bollinger_std}
                  onChange={(e) => setFormSettings({ ...formSettings, bollinger_std: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                거래량 배수
                <input
                  type="number"
                  step="0.1"
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.volume_multiplier}
                  onChange={(e) => setFormSettings({ ...formSettings, volume_multiplier: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                중복 알림 제한(분)
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.cooldown_minutes}
                  onChange={(e) => setFormSettings({ ...formSettings, cooldown_minutes: Number(e.target.value) })}
                />
              </label>

              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formSettings.use_trend_filter} onChange={(e) => setFormSettings({ ...formSettings, use_trend_filter: e.target.checked })} /> 추세 필터</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formSettings.use_bollinger_support} onChange={(e) => setFormSettings({ ...formSettings, use_bollinger_support: e.target.checked })} /> 볼린저 중앙선 지지</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formSettings.use_volume_surge} onChange={(e) => setFormSettings({ ...formSettings, use_volume_surge: e.target.checked })} /> 거래량 급증</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formSettings.use_breakout} onChange={(e) => setFormSettings({ ...formSettings, use_breakout: e.target.checked })} /> 돌파 신호</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formSettings.use_rsi} onChange={(e) => setFormSettings({ ...formSettings, use_rsi: e.target.checked })} /> RSI 보조 사용</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formSettings.enable_telegram_notifications} onChange={(e) => setFormSettings({ ...formSettings, enable_telegram_notifications: e.target.checked })} /> 텔레그램 알림</label>

              <label className="text-sm sm:col-span-2">
                알림 강도
                <select
                  className="mt-1 w-full rounded-md border border-[#c9b89c] bg-white px-2 py-1"
                  value={formSettings.signal_strength_mode}
                  onChange={(e) => setFormSettings({ ...formSettings, signal_strength_mode: e.target.value as "all" | "strong_only" })}
                >
                  <option value="strong_only">강한 신호만</option>
                  <option value="all">모든 신호</option>
                </select>
              </label>

              <div className="sm:col-span-2">
                <button className="rounded-md bg-[#113c3a] px-4 py-2 text-sm font-semibold text-white">설정 저장</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#7a6a51]">설정 불러오는 중...</p>
          )}
        </form>

        <div className="card p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">시그널 로그</h2>
            <p className="text-xs text-[#7a6a51]">최근 발생 순</p>
          </div>
          <div className="max-h-[500px] space-y-3 overflow-auto pr-1">
            {signals.map((sig) => (
              <article key={`${sig.id ?? "ws"}-${sig.symbol}-${sig.created_at}`} className="rounded-xl border border-[#d8c9ae] bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{sig.symbol_name} ({sig.symbol})</p>
                    <p className="text-xs text-[#7a6a51]">{new Date(sig.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                  <SignalPill type={sig.signal_type} strength={sig.signal_strength} />
                </div>
                <p className="mb-2 text-sm text-[#304b4e]">{sig.reason_text}</p>
                <p className="text-xs text-[#7a6a51]">현재가 {numberFormat(sig.price)} / 거래량 {numberFormat(sig.volume)}</p>
              </article>
            ))}
            {signals.length === 0 ? <p className="text-sm text-[#7a6a51]">아직 시그널이 없습니다.</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
