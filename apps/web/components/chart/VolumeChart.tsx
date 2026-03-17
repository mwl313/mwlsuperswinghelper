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
  showVolume: boolean;
  showRsi: boolean;
};

export function VolumeChart({ volumeData, rsiData, showVolume, showRsi }: VolumeChartProps) {
  const volumeContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeChartRef = useRef<IChartApi | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  const volumeFittedRef = useRef(false);

  const rsiContainerRef = useRef<HTMLDivElement | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const overboughtSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const oversoldSeriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const rsiFittedRef = useRef(false);

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
      height: 160,
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
      volumeFittedRef.current = false;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    volumeSeriesRef.current?.setData(showVolume ? volumeData : []);
    if (showVolume && volumeData.length > 0 && !volumeFittedRef.current) {
      volumeChartRef.current?.timeScale().fitContent();
      volumeFittedRef.current = true;
    }
  }, [volumeData, showVolume]);

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
      height: 150,
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
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#e2e8f0",
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
      rsiFittedRef.current = false;
    };
  }, [showRsi]);

  useEffect(() => {
    if (!showRsi) return;
    rsiSeriesRef.current?.setData(rsiData);
    overboughtSeriesRef.current?.setData(rsiGuideData);
    oversoldSeriesRef.current?.setData(rsiGuideLowData);
    if (rsiData.length > 0 && !rsiFittedRef.current) {
      rsiChartRef.current?.timeScale().fitContent();
      rsiFittedRef.current = true;
    }
  }, [showRsi, rsiData, rsiGuideData, rsiGuideLowData]);

  return (
    <div className="space-y-3">
      <div>
        <p className={`mb-1 text-[11px] font-semibold text-[#5b6f82] ${showVolume ? "" : "hidden"}`}>거래량</p>
        <div className={`h-[160px] w-full ${showVolume ? "" : "hidden"}`} ref={volumeContainerRef} />
      </div>
      {showRsi ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold text-[#5b6f82]">RSI(14)</p>
          <div className="h-[150px] w-full" ref={rsiContainerRef} />
        </div>
      ) : null}
    </div>
  );
}
