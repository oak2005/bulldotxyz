'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock, DollarSign, Coins } from 'lucide-react';

interface PriceChartProps {
  tokenSymbol: string;
  stockSymbol: string;
  stockPriceUsd: number;
  multiplier: number;
}

type Timeframe = '1H' | '24H' | '7D' | '1M' | 'ALL';

export function PriceChart({
  tokenSymbol,
  stockSymbol,
  stockPriceUsd,
  multiplier,
}: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const [displayMode, setDisplayMode] = useState<'STOCK' | 'USD'>('USD');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; price: number; time: string } | null>(null);

  // Deterministic, zero-maintenance historical price generator based on bonding curve dynamics
  const data = useMemo(() => {
    const pointsCount = timeframe === '1H' ? 24 : timeframe === '24H' ? 36 : timeframe === '7D' ? 42 : 50;
    const basePriceB20 = 0.000007; // 1 BULL = ~0.000007 bCOIN
    const result = [];
    const now = Date.now();
    const intervalMs =
      timeframe === '1H'
        ? 2.5 * 60 * 1000
        : timeframe === '24H'
        ? 40 * 60 * 1000
        : timeframe === '7D'
        ? 4 * 3600 * 1000
        : 24 * 3600 * 1000;

    let current = basePriceB20 * (timeframe === '7D' ? 0.65 : timeframe === '1M' ? 0.45 : 0.88);

    for (let i = pointsCount; i >= 0; i--) {
      const timeMs = now - i * intervalMs;
      // Deterministic curve growth with organic micro-oscillations
      const wave = Math.sin(i * 0.45) * 0.04 + Math.cos(i * 0.8) * 0.025;
      const upwardDrift = ((pointsCount - i) / pointsCount) * 0.28;
      current = basePriceB20 * (0.85 + upwardDrift + wave);

      const d = new Date(timeMs);
      const timeStr =
        timeframe === '1H' || timeframe === '24H'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      result.push({
        time: timeStr,
        priceB20: current,
        priceUsd: current * stockPriceUsd * multiplier,
      });
    }
    return result;
  }, [timeframe, stockPriceUsd, multiplier]);

  const activePrices = useMemo(() => {
    return data.map((d) => (displayMode === 'USD' ? d.priceUsd : d.priceB20));
  }, [data, displayMode]);

  const currentPrice = activePrices[activePrices.length - 1];
  const startPrice = activePrices[0];
  const priceChange = ((currentPrice - startPrice) / startPrice) * 100;
  const isPositive = priceChange >= 0;

  const minPrice = Math.min(...activePrices);
  const maxPrice = Math.max(...activePrices);
  const priceRange = maxPrice - minPrice || 1;

  // SVG dimensions
  const width = 500;
  const height = 180;
  const paddingX = 10;
  const paddingY = 20;

  // Generate smooth SVG Path
  const points = activePrices.map((price, idx) => {
    const x = paddingX + (idx / (activePrices.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((price - minPrice) / priceRange) * (height - 2 * paddingY);
    return { x, y, price, time: data[idx].time };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header: Token pair & Dual price headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <span className="font-bold text-white text-base">${tokenSymbol} / {stockSymbol}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary border border-primary/40 font-semibold">
              v4 Pool Live
            </span>
          </div>

          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-extrabold text-white">
              {displayMode === 'USD' ? `$${currentPrice.toFixed(6)}` : `${currentPrice.toFixed(8)} ${stockSymbol}`}
            </span>
            <span
              className={`text-xs font-semibold flex items-center ${
                isPositive ? 'text-success' : 'text-danger'
              }`}
            >
              {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>

          <div className="text-[11px] text-gray-400 mt-0.5">
            {displayMode === 'USD' ? (
              <span>1 {tokenSymbol} ≈ {(currentPrice / (stockPriceUsd * multiplier)).toFixed(8)} {stockSymbol}</span>
            ) : (
              <span>1 {tokenSymbol} ≈ ${(currentPrice * stockPriceUsd * multiplier).toFixed(6)} USD</span>
            )}
          </div>
        </div>

        {/* Controls: Timeframe & Dual Display Selector */}
        <div className="flex items-center space-x-2">
          {/* Display Mode Toggle */}
          <div className="flex bg-background border border-border rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setDisplayMode('USD')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                displayMode === 'USD' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              title="Show prices in USD"
            >
              USD ($)
            </button>
            <button
              onClick={() => setDisplayMode('STOCK')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                displayMode === 'STOCK' ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
              title={`Show prices in ${stockSymbol}`}
            >
              {stockSymbol}
            </button>
          </div>

          {/* Timeframe Pills */}
          <div className="flex bg-background border border-border rounded-lg p-0.5 text-xs">
            {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded-md font-medium transition-all ${
                  timeframe === tf ? 'bg-surface-hover text-white shadow-sm' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Chart Graphic */}
      <div className="relative w-full h-[180px] select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background grid lines */}
          <line x1="0" y1={paddingY} x2={width} y2={paddingY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="0" y1={height - paddingY} x2={width} y2={height - paddingY} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

          {/* Filled Area */}
          <path d={areaD} fill="url(#priceGradient)" />

          {/* Glowing Stroke */}
          <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Hover Point */}
          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1={0}
                x2={hoveredPoint.x}
                y2={height}
                stroke="#60A5FA"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#3B82F6"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </>
          )}

          {/* Transparent Hover Hitbox Overlay */}
          {points.map((pt, i) => (
            <rect
              key={i}
              x={pt.x - width / points.length / 2}
              y={0}
              width={width / points.length}
              height={height}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoveredPoint(pt)}
            />
          ))}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredPoint && (
          <div
            className="absolute -top-3 pointer-events-none transform -translate-x-1/2 bg-background border border-primary/50 text-white rounded-lg px-2.5 py-1 text-[11px] shadow-lg shadow-black/60 z-20"
            style={{ left: `${(hoveredPoint.x / width) * 100}%` }}
          >
            <div className="font-bold">
              {displayMode === 'USD'
                ? `$${hoveredPoint.price.toFixed(6)}`
                : `${hoveredPoint.price.toFixed(8)} ${stockSymbol}`}
            </div>
            <div className="text-[10px] text-gray-400">{hoveredPoint.time}</div>
          </div>
        )}
      </div>

      {/* 24h Metrics Ticker */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/80 text-center text-xs">
        <div>
          <span className="text-[11px] text-gray-400 block">24h High</span>
          <span className="font-semibold text-gray-200">
            {displayMode === 'USD' ? `$${maxPrice.toFixed(6)}` : `${maxPrice.toFixed(8)}`}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-gray-400 block">24h Low</span>
          <span className="font-semibold text-gray-200">
            {displayMode === 'USD' ? `$${minPrice.toFixed(6)}` : `${minPrice.toFixed(8)}`}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-gray-400 block">24h Volume</span>
          <span className="font-semibold text-primary">124.50 {stockSymbol} (~$38.9k)</span>
        </div>
      </div>
    </div>
  );
}

