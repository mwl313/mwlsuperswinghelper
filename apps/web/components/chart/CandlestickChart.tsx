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
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "#fffdf7" },
        textColor: "#274a4d",
      },
      grid: {
        vertLines: { color: "#efe4d1" },
        horzLines: { color: "#efe4d1" },
      },
      rightPriceScale: {
        borderColor: "#d8c9ae",
      },
      timeScale: {
        borderColor: "#d8c9ae",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "#8ba7a5" },
        horzLine: { color: "#8ba7a5" },
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
    const ma20Series = chart.addSeries(LineSeries, { color: "#2d6cdf", lineWidth: 2, priceLineVisible: false });
    const ma60Series = chart.addSeries(LineSeries, { color: "#7b4cbf", lineWidth: 2, priceLineVisible: false });
    const bbUpperSeries = chart.addSeries(LineSeries, { color: "#a0a0a0", lineWidth: 1, priceLineVisible: false });
    const bbMidSeries = chart.addSeries(LineSeries, { color: "#8a8a8a", lineWidth: 1, priceLineVisible: false });
    const bbLowerSeries = chart.addSeries(LineSeries, { color: "#a0a0a0", lineWidth: 1, priceLineVisible: false });

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
    if (candles.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles, ma20, ma60, bollingerUpper, bollingerMid, bollingerLower, markers, showMarkers]);

  return <div className="h-[420px] w-full rounded-xl border border-[#d8c9ae] bg-white" ref={containerRef} />;
}

