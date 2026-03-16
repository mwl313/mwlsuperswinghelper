"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CandlestickData, HistogramData, LineData, SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";

import { CandlestickChart } from "@/components/chart/CandlestickChart";
import { ChartControls } from "@/components/chart/ChartControls";
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
};

const signalTypeText: Record<SignalType, string> = {
  buy_candidate: "매수 후보",
  breakout: "돌파 감시",
  sell_warning: "매도 경고",
};

const markerColorMap: Record<SignalType, string> = {
  buy_candidate: "#1f7a59",
  breakout: "#2d6cdf",
  sell_warning: "#a4302d",
};

function toUtcTime(timestamp: string): UTCTimestamp {
  return Math.floor(new Date(timestamp).getTime() / 1000) as UTCTimestamp;
}

function toMs(timestamp: string): number {
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? 0 : ms;
}

function numberFormat(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("ko-KR", { maximumFractionDigits: digits });
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

  const next = [...current];
  const existingIndex = next.findIndex((row) => row.timestamp === incoming.timestamp);
  const last = next[next.length - 1];
  const lastTs = last ? toMs(last.timestamp) : 0;

  if (eventType === "candle_update") {
    if (existingIndex >= 0) {
      next[existingIndex] = incoming;
      return next;
    }
    if (incomingTs >= lastTs) {
      next.push(incoming);
      return next.slice(-maxLength);
    }
    return current;
  }

  if (existingIndex >= 0) {
    next[existingIndex] = incoming;
    return next;
  }
  if (incomingTs > lastTs) {
    next.push(incoming);
    return next.slice(-maxLength);
  }
  return current;
}

export function ChartSection({ symbols, selectedSymbol, onSelectSymbol, liveQuote, recentSignal }: ChartSectionProps) {
  const [chartData, setChartData] = useState<ChartResponse | null>(null);
  const [showRsi, setShowRsi] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMeta = useMemo(() => symbols.find((row) => row.symbol === selectedSymbol) ?? null, [symbols, selectedSymbol]);

  const loadChart = useCallback(async () => {
    if (!selectedSymbol) return;
    setIsLoading(true);
    try {
      const data = await getChart(selectedSymbol, 240);
      setChartData({ ...data, overlays: recalcOverlays(data.candles) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "차트 데이터 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (!selectedSymbol) {
      setChartData(null);
      return;
    }
    void loadChart();
  }, [selectedSymbol, loadChart]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as unknown;
        if (!isCandleWsEvent(payload)) return;
        if (payload.symbol !== selectedSymbol) return;

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
      } catch {
        // ignore malformed payload
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedSymbol]);

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

    const candles: CandlestickData<Time>[] = chartData.candles.map((row) => ({
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

    const volume: HistogramData<Time>[] = chartData.candles.map((row) => ({
      time: toUtcTime(row.timestamp),
      value: row.volume,
      color: row.close >= row.open ? "#1f7a59" : "#a4302d",
    }));

    const markers: SeriesMarker<Time>[] = chartData.markers.map((row) => ({
      time: toUtcTime(row.timestamp),
      position: row.type === "sell_warning" ? "aboveBar" : "belowBar",
      color: markerColorMap[row.type],
      shape: row.type === "sell_warning" ? "arrowDown" : row.type === "breakout" ? "circle" : "arrowUp",
      text: row.title,
    }));

    return { candles, ma20, ma60, bbUpper, bbMid, bbLower, volume, rsi14, markers };
  }, [chartData]);

  if (!selectedSymbol || symbols.length === 0) {
    return (
      <section className="card p-5 md:p-6">
        <h2 className="mb-2 text-xl font-bold">차트</h2>
        <p className="text-sm text-[#496466]">워치리스트에 종목을 추가하면 여기에서 캔들 차트를 확인할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="card p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">차트</h2>
          <p className="text-sm text-[#496466]">초기 로드는 REST, 이후 갱신은 WebSocket으로 반영됩니다.</p>
        </div>
        <p className="text-xs text-[#7a6a51]">실시간 이벤트: candle_update / candle_closed</p>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#d8c9ae] bg-white p-3">
          <p className="text-xs text-[#7a6a51]">종목</p>
          <p className="mt-1 font-semibold">
            {liveQuote?.symbol_name ?? selectedMeta?.symbol_name ?? selectedSymbol} ({selectedSymbol})
          </p>
        </div>
        <div className="rounded-xl border border-[#d8c9ae] bg-white p-3">
          <p className="text-xs text-[#7a6a51]">현재가</p>
          <p className="mt-1 font-semibold">{numberFormat(liveQuote?.price, 2)}</p>
        </div>
        <div className="rounded-xl border border-[#d8c9ae] bg-white p-3">
          <p className="text-xs text-[#7a6a51]">변동률</p>
          <p className={`mt-1 font-semibold ${(liveQuote?.change_percent ?? 0) < 0 ? "text-[#a4302d]" : "text-[#1f7a59]"}`}>
            {liveQuote?.change_percent !== null && liveQuote?.change_percent !== undefined ? `${liveQuote.change_percent.toFixed(2)}%` : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-[#d8c9ae] bg-white p-3">
          <p className="text-xs text-[#7a6a51]">최근 시그널</p>
          <p className="mt-1 font-semibold">
            {recentSignal ? `${signalTypeText[recentSignal.signal_type]} (${recentSignal.signal_strength})` : "최근 신호 없음"}
          </p>
        </div>
      </div>

      <ChartControls
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        showRsi={showRsi}
        showMarkers={showMarkers}
        isLoading={isLoading}
        onSelectSymbol={onSelectSymbol}
        onToggleRsi={setShowRsi}
        onToggleMarkers={setShowMarkers}
        onRefresh={() => {
          void loadChart();
        }}
      />

      {error ? <p className="mb-3 text-sm text-[#a4302d]">오류: {error}</p> : null}

      <div className="space-y-3">
        <CandlestickChart
          candles={chartSeries.candles}
          ma20={chartSeries.ma20}
          ma60={chartSeries.ma60}
          bollingerUpper={chartSeries.bbUpper}
          bollingerMid={chartSeries.bbMid}
          bollingerLower={chartSeries.bbLower}
          markers={chartSeries.markers}
          showMarkers={showMarkers}
        />
        <VolumeChart volumeData={chartSeries.volume} rsiData={chartSeries.rsi14} showRsi={showRsi} />
      </div>

      {chartSeries.candles.length === 0 ? (
        <p className="mt-3 text-xs text-[#7a6a51]">아직 캔들 데이터가 충분하지 않습니다. 잠시 후 실시간 이벤트로 갱신됩니다.</p>
      ) : null}
    </section>
  );
}
