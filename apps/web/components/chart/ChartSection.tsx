"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CandlestickData, HistogramData, LineData, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";

import { CandlestickChart } from "@/components/chart/CandlestickChart";
import { ChartControls } from "@/components/chart/ChartControls";
import { ChartLegend } from "@/components/chart/ChartLegend";
import { VolumeChart } from "@/components/chart/VolumeChart";
import { WS_URL, getChart } from "@/lib/api";
import { CandleWsEvent, ChartCandle, ChartOverlayPoint, ChartOverlays, ChartResponse, LiveWatchlistItem, SignalLog, SignalType } from "@/lib/types";

type ChartSymbolOption = {
  symbol: string;
  symbol_name: string;
};

type ChartSectionProps = {
  symbols: ChartSymbolOption[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  liveQuote: LiveWatchlistItem | null;
  recentSignal: SignalLog | null;
  onOpenPositionEditor: (symbol: string) => void;
};

type ChartTimeframe = "1m" | "5m" | "15m" | "1h";

const signalTypeText: Record<SignalType, string> = {
  buy_candidate: "매수 후보",
  breakout: "돌파 감시",
  sell_warning: "매도 경고",
};

const timeframeLabel: Record<ChartTimeframe, string> = {
  "1m": "1분봉",
  "5m": "5분봉",
  "15m": "15분봉",
  "1h": "1시간봉",
};

const initialVisibleBarsByTimeframe: Record<ChartTimeframe, number> = {
  "1m": 120,
  "5m": 96,
  "15m": 84,
  "1h": 72,
};

const markerColorMap: Record<SignalType, string> = {
  buy_candidate: "#1f7a59",
  breakout: "#2d6cdf",
  sell_warning: "#a4302d",
};

const markerShortLabelMap: Record<SignalType, string> = {
  buy_candidate: "매수",
  breakout: "돌파",
  sell_warning: "경고",
};

function toUtcTime(timestamp: string): UTCTimestamp {
  return Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;
}

function toMs(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? 0 : ms;
}

function normalizeCandles(candles: ChartCandle[], maxLength = 240): ChartCandle[] {
  const indexed = new Map<number, ChartCandle>();
  for (const candle of candles) {
    const ms = toMs(candle.timestamp);
    if (!ms) continue;
    indexed.set(ms, candle);
  }
  const ordered = [...indexed.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, candle]) => candle);
  if (ordered.length <= maxLength) {
    return ordered;
  }
  return ordered.slice(-maxLength);
}

function numberFormat(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

function formatKstDateTime(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function smaSeries(candles: ChartCandle[], period: number): ChartOverlayPoint[] {
  if (candles.length < period) return [];
  const result: ChartOverlayPoint[] = [];
  const closes = candles.map((row) => row.close);
  for (let i = period - 1; i < candles.length; i += 1) {
    const window = closes.slice(i - period + 1, i + 1);
    const avg = window.reduce((sum, value) => sum + value, 0) / period;
    result.push({ timestamp: candles[i].timestamp, value: round(avg) });
  }
  return result;
}

function bollingerSeries(candles: ChartCandle[], length: number, stdFactor: number): [ChartOverlayPoint[], ChartOverlayPoint[], ChartOverlayPoint[]] {
  if (candles.length < length) return [[], [], []];
  const upper: ChartOverlayPoint[] = [];
  const mid: ChartOverlayPoint[] = [];
  const lower: ChartOverlayPoint[] = [];
  const closes = candles.map((row) => row.close);
  for (let i = length - 1; i < candles.length; i += 1) {
    const window = closes.slice(i - length + 1, i + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / length;
    const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / length;
    const std = Math.sqrt(variance);
    upper.push({ timestamp: candles[i].timestamp, value: round(mean + stdFactor * std) });
    mid.push({ timestamp: candles[i].timestamp, value: round(mean) });
    lower.push({ timestamp: candles[i].timestamp, value: round(mean - stdFactor * std) });
  }
  return [upper, mid, lower];
}

function rsiSeries(candles: ChartCandle[], period = 14): ChartOverlayPoint[] {
  if (candles.length < period + 1) return [];
  const closes = candles.map((row) => row.close);
  const points: ChartOverlayPoint[] = [];
  for (let i = period; i < closes.length; i += 1) {
    const deltas = closes.slice(i - period, i + 1).map((value, index, array) => (index === 0 ? 0 : value - array[index - 1])).slice(1);
    const gains = deltas.map((delta) => Math.max(delta, 0));
    const losses = deltas.map((delta) => Math.abs(Math.min(delta, 0)));
    const avgGain = gains.reduce((sum, value) => sum + value, 0) / period;
    const avgLoss = losses.reduce((sum, value) => sum + value, 0) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    points.push({ timestamp: candles[i].timestamp, value: round(rsi) });
  }
  return points;
}

function recalcOverlays(candles: ChartCandle[]): ChartOverlays {
  const ma20 = smaSeries(candles, 20);
  const ma60 = smaSeries(candles, 60);
  const [bollingerUpper, bollingerMid, bollingerLower] = bollingerSeries(candles, 20, 2.0);
  const rsi14 = rsiSeries(candles, 14);
  return {
    ma20,
    ma60,
    bollinger_upper: bollingerUpper,
    bollinger_mid: bollingerMid,
    bollinger_lower: bollingerLower,
    rsi14,
  };
}

function isCandleWsEvent(value: unknown): value is CandleWsEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CandleWsEvent>;
  return (event.type === "candle_update" || event.type === "candle_closed") && typeof event.symbol === "string" && !!event.candle;
}

function mergeCandles(current: ChartCandle[], incoming: ChartCandle, eventType: CandleWsEvent["type"], maxLength = 240): ChartCandle[] {
  const incomingTs = toMs(incoming.timestamp);
  if (!incomingTs) return current;

  const next = normalizeCandles(current, maxLength + 1);
  const existingIndex = next.findIndex((row) => toMs(row.timestamp) === incomingTs);
  const last = next[next.length - 1];
  const lastTs = last ? toMs(last.timestamp) : 0;

  if (eventType === "candle_update") {
    if (existingIndex >= 0) {
      next[existingIndex] = incoming;
      return next;
    }
    if (incomingTs >= lastTs) {
      next.push(incoming);
      return normalizeCandles(next, maxLength);
    }
    return current;
  }

  if (existingIndex >= 0) {
    next[existingIndex] = incoming;
    return next;
  }
  if (incomingTs > lastTs) {
    next.push(incoming);
    return normalizeCandles(next, maxLength);
  }
  return current;
}

export function ChartSection({ symbols, selectedSymbol, onSelectSymbol, liveQuote, recentSignal, onOpenPositionEditor }: ChartSectionProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1m");
  const [chartData, setChartData] = useState<ChartResponse | null>(null);
  const [showCandles, setShowCandles] = useState(true);
  const [showMa20, setShowMa20] = useState(true);
  const [showMa60, setShowMa60] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMeta = useMemo(() => symbols.find((row) => row.symbol === selectedSymbol) ?? null, [symbols, selectedSymbol]);

  const loadChart = useCallback(async () => {
    if (!selectedSymbol) return;
    setIsLoading(true);
    try {
      const data = await getChart(selectedSymbol, 240, timeframe);
      const normalizedCandles = normalizeCandles(data.candles, 240);
      setChartData({ ...data, candles: normalizedCandles, overlays: recalcOverlays(normalizedCandles) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "차트 데이터 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    if (!selectedSymbol) {
      setChartData(null);
      return;
    }
    void loadChart();
  }, [selectedSymbol, timeframe, loadChart]);

  useEffect(() => {
    if (!selectedSymbol) {
      setWsConnected(false);
      return;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown;
        if (!isCandleWsEvent(payload)) return;
        if (payload.symbol !== selectedSymbol) return;

        if (timeframe === "1m") {
          setChartData((prev) => {
            if (!prev || prev.symbol !== selectedSymbol) return prev;
            const nextCandles = mergeCandles(prev.candles, payload.candle, payload.type, 240);
            if (nextCandles === prev.candles) return prev;
            return {
              ...prev,
              candles: nextCandles,
              overlays: recalcOverlays(nextCandles),
            };
          });
          return;
        }

        if (payload.type === "candle_closed") {
          void loadChart();
        }
      } catch {
        // ignore malformed ws payload
      }
    };

    return () => {
      setWsConnected(false);
      ws.close();
    };
  }, [selectedSymbol, timeframe, loadChart]);

  const chartSeries = useMemo(() => {
    if (!chartData) {
      return {
        candles: [] as CandlestickData<Time>[],
        ma20: [] as LineData<Time>[],
        ma60: [] as LineData<Time>[],
        bbUpper: [] as LineData<Time>[],
        bbMid: [] as LineData<Time>[],
        bbLower: [] as LineData<Time>[],
        volume: [] as HistogramData<Time>[],
        rsi14: [] as LineData<Time>[],
        markers: [] as SeriesMarker<Time>[],
      };
    }

    const normalizedCandles = normalizeCandles(chartData.candles, 240);

    const candles: CandlestickData<Time>[] = normalizedCandles.map((row) => ({
      time: toUtcTime(row.timestamp),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    const ma20 = chartData.overlays.ma20.map((row) => ({ time: toUtcTime(row.timestamp), value: row.value }));
    const ma60 = chartData.overlays.ma60.map((row) => ({ time: toUtcTime(row.timestamp), value: row.value }));
    const bbUpper = chartData.overlays.bollinger_upper.map((row) => ({ time: toUtcTime(row.timestamp), value: row.value }));
    const bbMid = chartData.overlays.bollinger_mid.map((row) => ({ time: toUtcTime(row.timestamp), value: row.value }));
    const bbLower = chartData.overlays.bollinger_lower.map((row) => ({ time: toUtcTime(row.timestamp), value: row.value }));
    const rsi14 = chartData.overlays.rsi14.map((row) => ({ time: toUtcTime(row.timestamp), value: row.value }));

    const volume: HistogramData<Time>[] = normalizedCandles.map((row) => ({
      time: toUtcTime(row.timestamp),
      value: row.volume,
      color: row.close >= row.open ? "#1f7a59" : "#a4302d",
    }));

    const markers: SeriesMarker<Time>[] = chartData.markers.map((row) => ({
      time: toUtcTime(row.timestamp),
      position: row.type === "sell_warning" ? "aboveBar" : "belowBar",
      color: markerColorMap[row.type],
      shape: row.type === "sell_warning" ? "arrowDown" : row.type === "breakout" ? "circle" : "arrowUp",
      text: markerShortLabelMap[row.type],
    }));

    return { candles, ma20, ma60, bbUpper, bbMid, bbLower, volume, rsi14, markers };
  }, [chartData]);

  const latestCandleTimestamp = useMemo(() => {
    if (!chartData || chartData.candles.length === 0) return null;
    return chartData.candles[chartData.candles.length - 1].timestamp;
  }, [chartData]);

  const recentMarkerRows = useMemo(() => {
    if (!chartData || !showMarkers) return [];
    return [...chartData.markers].sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp)).slice(0, 4);
  }, [chartData, showMarkers]);

  if (!selectedSymbol || symbols.length === 0) {
    return (
      <section className="card p-5 md:p-6">
        <h2 className="mb-2 text-xl font-bold">차트</h2>
        <p className="text-sm text-[#496466]">워치리스트에 종목을 추가하면 여기에서 캔들 차트를 확인할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="card overflow-hidden p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6a8094]">Instrument</p>
            <h2 className="text-lg font-bold text-[#183244]">
              {liveQuote?.symbol_name ?? selectedMeta?.symbol_name ?? selectedSymbol}
              <span className="ml-2 text-sm font-medium text-[#6a8094]">{selectedSymbol}</span>
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#6a8094]">마지막 반영</p>
            <p className="text-xs font-semibold text-[#264256]">{formatKstDateTime(latestCandleTimestamp)}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2">
            <p className="text-[11px] text-[#6a8094]">현재가</p>
            <p className="mt-0.5 text-xl font-bold text-[#193243]">{numberFormat(liveQuote?.price, 2)}</p>
          </div>
          <div className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2">
            <p className="text-[11px] text-[#6a8094]">변동률</p>
            <p className={`mt-1 text-base font-semibold ${(liveQuote?.change_percent ?? 0) < 0 ? "text-[#b42318]" : "text-[#027a48]"}`}>
              {liveQuote?.change_percent !== null && liveQuote?.change_percent !== undefined ? `${liveQuote.change_percent.toFixed(2)}%` : "-"}
            </p>
          </div>
          <div className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2">
            <p className="text-[11px] text-[#6a8094]">최근 시그널</p>
            <p className="mt-1 text-sm font-semibold text-[#1b3447]">
              {recentSignal ? `${signalTypeText[recentSignal.signal_type]} (${recentSignal.signal_strength})` : "최근 신호 없음"}
            </p>
          </div>
          <div className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2">
            <p className="text-[11px] text-[#6a8094]">실시간 상태</p>
            <p className={`mt-1 text-sm font-semibold ${wsConnected ? "text-[#027a48]" : "text-[#b42318]"}`}>{wsConnected ? "연결됨" : "재연결 중"}</p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#233f53]">내 포지션 요약</p>
            <button className="rounded-md border border-[#c4d0dc] bg-white px-2 py-1 text-xs" type="button" onClick={() => onOpenPositionEditor(selectedSymbol)}>
              포지션 수정
            </button>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4e6376]">
            <span>상태: {liveQuote?.holding_state === "holding" ? "보유중" : "미보유"}</span>
            <span>진입가: {liveQuote?.entry_price ? `${numberFormat(liveQuote.entry_price, 0)}원` : "-"}</span>
            <span>수량: {liveQuote?.quantity ? numberFormat(liveQuote.quantity, 4) : "-"}</span>
            <span>손절: {liveQuote?.stop_loss_price ? `${numberFormat(liveQuote.stop_loss_price, 0)}원` : "-"}</span>
            <span>익절: {liveQuote?.take_profit_price ? `${numberFormat(liveQuote.take_profit_price, 0)}원` : "-"}</span>
            <span className={(liveQuote?.pnl_percent ?? 0) < 0 ? "text-[#b42318]" : "text-[#027a48]"}>
              손익률: {liveQuote?.pnl_percent !== null && liveQuote?.pnl_percent !== undefined ? `${liveQuote.pnl_percent.toFixed(2)}%` : "-"}
            </span>
          </div>
        </div>
      </div>

      <ChartControls
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        timeframe={timeframe}
        isLoading={isLoading}
        onSelectSymbol={onSelectSymbol}
        onTimeframeChange={setTimeframe}
        onRefresh={() => {
          void loadChart();
        }}
      />

      <ChartLegend
        toggles={{
          candles: showCandles,
          ma20: showMa20,
          ma60: showMa60,
          bollinger: showBollinger,
          markers: showMarkers,
          rsi: showRsi,
          volume: showVolume,
        }}
        onToggle={(key, next) => {
          if (key === "candles") setShowCandles(next);
          if (key === "ma20") setShowMa20(next);
          if (key === "ma60") setShowMa60(next);
          if (key === "bollinger") setShowBollinger(next);
          if (key === "markers") setShowMarkers(next);
          if (key === "rsi") setShowRsi(next);
          if (key === "volume") setShowVolume(next);
        }}
      />

      {error ? <p className="mb-3 text-sm text-[#a4302d]">오류: {error}</p> : null}

      <div className="card p-3 md:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#243d51]">가격 차트 ({timeframeLabel[timeframe]})</p>
          <p className="text-[11px] text-[#61768a]">
            {timeframe === "1m"
              ? "1분봉은 실시간으로 즉시 반영됩니다."
              : `${timeframeLabel[timeframe]}은 봉 마감 이벤트 기준으로 새로고침 반영됩니다.`}
          </p>
        </div>
        <div className="rounded-xl border border-[#d7e0e8] bg-white p-2">
          <CandlestickChart
            candles={chartSeries.candles}
            ma20={chartSeries.ma20}
            ma60={chartSeries.ma60}
            bollingerUpper={chartSeries.bbUpper}
            bollingerMid={chartSeries.bbMid}
            bollingerLower={chartSeries.bbLower}
            markers={chartSeries.markers}
            showCandles={showCandles}
            showMa20={showMa20}
            showMa60={showMa60}
            showBollinger={showBollinger}
            showMarkers={showMarkers}
            rangeKey={`${selectedSymbol}-${timeframe}`}
            initialVisibleBars={initialVisibleBarsByTimeframe[timeframe]}
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card p-3 md:p-4">
          <VolumeChart volumeData={chartSeries.volume} rsiData={chartSeries.rsi14} showVolume={showVolume} showRsi={showRsi} />
          {!showVolume && !showRsi ? (
            <p className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2 text-xs text-[#5f7387]">거래량/RSI가 모두 숨김 상태입니다.</p>
          ) : null}
        </div>

        <aside className="card p-3 md:p-4">
          <h3 className="text-sm font-semibold text-[#243d51]">최근 시그널 설명</h3>
          <p className="mt-1 text-xs text-[#5f7387]">마커를 끄더라도 최근 신호 이유는 여기서 확인할 수 있습니다.</p>
          <div className="mt-3 space-y-2">
            {recentMarkerRows.length === 0 ? (
              <p className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2 text-xs text-[#5f7387]">
                {showMarkers ? "최근 신호가 없습니다." : "시그널 마커가 꺼져 있습니다."}
              </p>
            ) : (
              recentMarkerRows.map((marker) => (
                <div key={`${marker.timestamp}-${marker.type}`} className="rounded-lg border border-[#d7e0e8] bg-[#f9fbff] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#203b4d]">{marker.title}</p>
                    <p className="text-[11px] text-[#6a8094]">{formatKstDateTime(marker.timestamp)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[#4e6376]">{marker.description}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {chartSeries.candles.length === 0 ? (
        <p className="mt-3 text-xs text-[#5f7387]">아직 캔들 데이터가 충분하지 않습니다. 잠시 후 다시 확인해주세요.</p>
      ) : null}
    </section>
  );
}
