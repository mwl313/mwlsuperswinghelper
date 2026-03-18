"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineData,
  LineSeries,
  SeriesMarker,
  Time,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";

const tickTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function toEpochMs(time: Time): number {
  if (typeof time === "number") {
    return time * 1000;
  }
  if (typeof time === "string") {
    return Date.parse(time);
  }
  if ("year" in time) {
    return Date.UTC(time.year, time.month - 1, time.day);
  }
  return 0;
}

function formatKstTick(time: Time): string {
  const ms = toEpochMs(time);
  if (!Number.isFinite(ms) || ms <= 0) {
    return "";
  }
  return tickTimeFormatter.format(new Date(ms));
}

type CandlestickChartProps = {
  candles: CandlestickData<Time>[];
  ma20: LineData<Time>[];
  ma60: LineData<Time>[];
  bollingerUpper: LineData<Time>[];
  bollingerMid: LineData<Time>[];
  bollingerLower: LineData<Time>[];
  markers: SeriesMarker<Time>[];
  showCandles: boolean;
  showMa20: boolean;
  showMa60: boolean;
  showBollinger: boolean;
  showMarkers: boolean;
  rangeKey: string;
  initialVisibleBars: number;
};

export function CandlestickChart({
  candles,
  ma20,
  ma60,
  bollingerUpper,
  bollingerMid,
  bollingerLower,
  markers,
  showCandles,
  showMa20,
  showMa60,
  showBollinger,
  showMarkers,
  rangeKey,
  initialVisibleBars,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const initialViewportAppliedRef = useRef(false);
  const lastRangeKeyRef = useRef<string | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const ma60SeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bbMidSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#516579",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        minBarSpacing: 2,
        tickMarkFormatter: (time: Time) => formatKstTick(time),
      },
      localization: {
        locale: "ko-KR",
        timeFormatter: (time: Time) => formatKstTick(time),
      },
      crosshair: {
        vertLine: { color: "#94a3b8" },
        horzLine: { color: "#94a3b8" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#1f7a59",
      downColor: "#a4302d",
      borderVisible: true,
      wickUpColor: "#1f7a59",
      wickDownColor: "#a4302d",
      borderUpColor: "#1f7a59",
      borderDownColor: "#a4302d",
    });
    const ma20Series = chart.addSeries(LineSeries, { color: "#2b6de0", lineWidth: 2, priceLineVisible: false });
    const ma60Series = chart.addSeries(LineSeries, { color: "#6b46c1", lineWidth: 2, priceLineVisible: false });
    const bbUpperSeries = chart.addSeries(LineSeries, { color: "#94a3b8", lineWidth: 1, priceLineVisible: false });
    const bbMidSeries = chart.addSeries(LineSeries, { color: "#64748b", lineWidth: 1, priceLineVisible: false });
    const bbLowerSeries = chart.addSeries(LineSeries, { color: "#94a3b8", lineWidth: 1, priceLineVisible: false });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ma20SeriesRef.current = ma20Series;
    ma60SeriesRef.current = ma60Series;
    bbUpperSeriesRef.current = bbUpperSeries;
    bbMidSeriesRef.current = bbMidSeries;
    bbLowerSeriesRef.current = bbLowerSeries;
    markerPluginRef.current = createSeriesMarkers(candleSeries, []);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({ width: Math.max(320, Math.floor(entry.contentRect.width)) });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      markerPluginRef.current = null;
      candleSeriesRef.current = null;
      ma20SeriesRef.current = null;
      ma60SeriesRef.current = null;
      bbUpperSeriesRef.current = null;
      bbMidSeriesRef.current = null;
      bbLowerSeriesRef.current = null;
      chartRef.current = null;
      initialViewportAppliedRef.current = false;
      lastRangeKeyRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (lastRangeKeyRef.current !== rangeKey) {
      lastRangeKeyRef.current = rangeKey;
      initialViewportAppliedRef.current = false;
    }
  }, [rangeKey]);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.setData(showCandles ? candles : []);
    ma20SeriesRef.current?.setData(showMa20 ? ma20 : []);
    ma60SeriesRef.current?.setData(showMa60 ? ma60 : []);
    bbUpperSeriesRef.current?.setData(showBollinger ? bollingerUpper : []);
    bbMidSeriesRef.current?.setData(showBollinger ? bollingerMid : []);
    bbLowerSeriesRef.current?.setData(showBollinger ? bollingerLower : []);
    markerPluginRef.current?.setMarkers(showMarkers && showCandles ? markers : []);

    if (showCandles && candles.length > 0 && !initialViewportAppliedRef.current) {
      const to = candles.length + 5;
      const from = Math.max(0, candles.length - Math.max(40, initialVisibleBars));
      chartRef.current?.timeScale().setVisibleLogicalRange({ from, to });
      initialViewportAppliedRef.current = true;
    }
  }, [
    candles,
    ma20,
    ma60,
    bollingerUpper,
    bollingerMid,
    bollingerLower,
    markers,
    showCandles,
    showMa20,
    showMa60,
    showBollinger,
    showMarkers,
    initialVisibleBars,
  ]);

  return <div className="h-[500px] w-full" ref={containerRef} />;
}
