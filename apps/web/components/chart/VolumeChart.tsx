"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ColorType,
  HistogramData,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
  LineData,
  LineSeries,
  LineStyle,
  Time,
  createChart,
} from "lightweight-charts";

type VolumeChartProps = {
  volumeData: HistogramData<Time>[];
  rsiData: LineData<Time>[];
  showRsi: boolean;
};

export function VolumeChart({ volumeData, rsiData, showRsi }: VolumeChartProps) {
  const volumeContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);

  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const overboughtSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const oversoldSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);

  const rsiGuideData = useMemo(() => {
    return rsiData.map((row) => ({ time: row.time, value: 70 }));
  }, [rsiData]);
  const rsiGuideLowData = useMemo(() => {
    return rsiData.map((row) => ({ time: row.time, value: 30 }));
  }, [rsiData]);

  useEffect(() => {
    const container = volumeContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 170,
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
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
    });

    volumeChartRef.current = chart;
    volumeSeriesRef.current = volumeSeries;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({ width: Math.max(320, Math.floor(entry.contentRect.width)) });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      volumeSeriesRef.current = null;
      volumeChartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    volumeSeriesRef.current?.setData(volumeData);
    if (volumeData.length > 0) {
      volumeChartRef.current?.timeScale().fitContent();
    }
  }, [volumeData]);

  useEffect(() => {
    if (!showRsi) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
        rsiSeriesRef.current = null;
        overboughtSeriesRef.current = null;
        oversoldSeriesRef.current = null;
      }
      return;
    }

    const container = rsiContainerRef.current;
    if (!container || rsiChartRef.current) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 160,
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
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#d8c9ae",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const rsiSeries = chart.addSeries(LineSeries, { color: "#bc5f07", lineWidth: 2, priceLineVisible: false });
    const overbought = chart.addSeries(LineSeries, {
      color: "#a4302d",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const oversold = chart.addSeries(LineSeries, {
      color: "#1f7a59",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    rsiChartRef.current = chart;
    rsiSeriesRef.current = rsiSeries;
    overboughtSeriesRef.current = overbought;
    oversoldSeriesRef.current = oversold;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({ width: Math.max(320, Math.floor(entry.contentRect.width)) });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      rsiChartRef.current = null;
      rsiSeriesRef.current = null;
      overboughtSeriesRef.current = null;
      oversoldSeriesRef.current = null;
    };
  }, [showRsi]);

  useEffect(() => {
    if (!showRsi) return;
    rsiSeriesRef.current?.setData(rsiData);
    overboughtSeriesRef.current?.setData(rsiGuideData);
    oversoldSeriesRef.current?.setData(rsiGuideLowData);
    if (rsiData.length > 0) {
      rsiChartRef.current?.timeScale().fitContent();
    }
  }, [showRsi, rsiData, rsiGuideData, rsiGuideLowData]);

  return (
    <div className="space-y-3">
      <div className="h-[170px] w-full rounded-xl border border-[#d8c9ae] bg-white" ref={volumeContainerRef} />
      {showRsi ? (
        <div>
          <p className="mb-2 text-xs text-[#7a6a51]">RSI(14)</p>
          <div className="h-[160px] w-full rounded-xl border border-[#d8c9ae] bg-white" ref={rsiContainerRef} />
        </div>
      ) : null}
    </div>
  );
}

