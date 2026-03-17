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

type CandlestickChartProps = {
  candles: CandlestickData<Time>[];
  ma20: LineData<Time>[];
  ma60: LineData<Time>[];
  bollingerUpper: LineData<Time>[];
  bollingerMid: LineData<Time>[];
  bollingerLower: LineData<Time>[];
  markers: SeriesMarker<Time>[];
  showMarkers: boolean;
};

export function CandlestickChart({
  candles,
  ma20,
  ma60,
  bollingerUpper,
  bollingerMid,
  bollingerLower,
  markers,
  showMarkers,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lastCandleCountRef = useRef(0);
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
      lastCandleCountRef.current = 0;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.setData(candles);
    ma20SeriesRef.current?.setData(ma20);
    ma60SeriesRef.current?.setData(ma60);
    bbUpperSeriesRef.current?.setData(bollingerUpper);
    bbMidSeriesRef.current?.setData(bollingerMid);
    bbLowerSeriesRef.current?.setData(bollingerLower);
    markerPluginRef.current?.setMarkers(showMarkers ? markers : []);
    if (candles.length > 0 && lastCandleCountRef.current === 0) {
      chartRef.current?.timeScale().fitContent();
    }
    lastCandleCountRef.current = candles.length;
  }, [candles, ma20, ma60, bollingerUpper, bollingerMid, bollingerLower, markers, showMarkers]);

  return <div className="h-[500px] w-full" ref={containerRef} />;
}
