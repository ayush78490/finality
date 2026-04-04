"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from "lightweight-charts";
import { fetchHistoricalKlines, fetchBinanceSpotPrice } from "@/lib/binance";

type Props = {
  points: { t: number; price: number }[];
  priceToBeat: number | null;
  livePrice: number | null;
  beatLineLabel?: string;
  caption?: string;
  symbol?: string;
};

export function PriceChart({
  points,
  priceToBeat,
  livePrice,
  beatLineLabel,
  caption,
  symbol
}: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current || !symbol) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#0b141d" },
        textColor: "#8ea4b8",
      },
      grid: {
        vertLines: { color: "rgba(32,48,64,0.85)" },
        horzLines: { color: "rgba(32,48,64,0.85)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(76, 201, 176, 0.5)",
          width: 1,
          style: 2,
        },
        horzLine: {
          color: "rgba(76, 201, 176, 0.5)",
          width: 1,
          style: 2,
        },
      },
      timeScale: {
        borderColor: "#223447",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 10,
        tickMarkFormatter: (time: Time) => {
          if (typeof time === 'number') {
            const date = new Date(time * 1000);
            return date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
          }
          return '';
        },
      },
      rightPriceScale: {
        borderColor: "#223447",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({
        width,
        height,
        timeScale: {
          barSpacing: width < 420 ? 6 : width < 720 ? 8 : 10,
          rightOffset: width < 420 ? 2 : 5,
          secondsVisible: width >= 700,
        },
        rightPriceScale: {
          scaleMargins: width < 420 ? { top: 0.12, bottom: 0.08 } : { top: 0.08, bottom: 0.06 },
        },
      });
    });
    resizeObserver.observe(chartContainerRef.current);

    const loadData = async () => {
      if (!symbol) return;
      setLoading(true);
      try {
        const klines = await fetchHistoricalKlines(symbol, "1m", 50);
        if (klines.length === 0) return;
        
        const now = Date.now();
        const cutoffTime = now - (30 * 60 * 1000);
        
        const filteredKlines = klines.filter(k => k.t >= cutoffTime);
        
        const candleData: CandlestickData[] = filteredKlines.map(k => ({
          time: (k.t / 1000) as Time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }));
        
        candleSeries.setData(candleData);
        
        setTimeout(() => {
          chart.timeScale().scrollToRealTime();
        }, 50);
      } catch (e) {
        console.error("Failed to load chart data:", e);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const pollPrice = async () => {
      if (!symbol || !candleSeries) return;
      try {
        const price = await fetchBinanceSpotPrice(symbol);
        const nowMs = Date.now();
        
        const data = candleSeries.data();
        if (!data || data.length === 0) return;
        
        const lastCandle = data[data.length - 1] as CandlestickData;
        
        if (typeof lastCandle.time === 'number') {
          const currentCandleStart = Math.floor(nowMs / 60000) * 60;
          const lastCandleStart = lastCandle.time;
          
          if (currentCandleStart === lastCandleStart) {
            candleSeries.update({
              time: lastCandle.time,
              open: lastCandle.open,
              high: Math.max(lastCandle.high, price),
              low: Math.min(lastCandle.low, price),
              close: price,
            });
          } else {
            candleSeries.update({
              time: currentCandleStart as Time,
              open: price,
              high: price,
              low: price,
              close: price,
            });
          }
        }
        
        chart.timeScale().scrollToRealTime();
      } catch (e) {
        console.error("Price poll error:", e);
      }
    };

    pollPrice();
    const pollInterval = setInterval(pollPrice, 3000);

    return () => {
      clearInterval(pollInterval);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [symbol]);

  useEffect(() => {
    if (!candleSeriesRef.current || points.length === 0 || !chartRef.current) return;
    
    const lastPoint = points[points.length - 1];
    const nowMs = Date.now();
    const currentCandleStart = Math.floor(nowMs / 60000) * 60;
    
    const data = candleSeriesRef.current.data();
    if (!data || data.length === 0) return;
    
    const lastCandle = data[data.length - 1] as CandlestickData;
    
    if (typeof lastCandle.time === 'number') {
      const lastCandleStart = lastCandle.time;
      
      if (currentCandleStart === lastCandleStart) {
        candleSeriesRef.current.update({
          time: lastCandle.time,
          open: lastCandle.open,
          high: Math.max(lastCandle.high, lastPoint.price),
          low: Math.min(lastCandle.low, lastPoint.price),
          close: lastPoint.price,
        });
      } else {
        candleSeriesRef.current.update({
          time: currentCandleStart as Time,
          open: lastPoint.price,
          high: lastPoint.price,
          low: lastPoint.price,
          close: lastPoint.price,
        });
      }
    }
    
    chartRef.current.timeScale().scrollToRealTime();
  }, [points]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b141d]/80 z-10">
          <span className="text-sm text-[#8ea4b8]">Loading chart...</span>
        </div>
      )}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}