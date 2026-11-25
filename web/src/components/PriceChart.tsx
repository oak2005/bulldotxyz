'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { PricePoint } from '../context/ProtocolContext';
import { SpotlightCard, snappySpring } from './MotionPrimitives';
import { TokenEmblem } from './BrandAssets';

interface PriceChartProps {
  tokenSymbol: string;
  stockSymbol: string;
  stockPriceUsd: number;
  multiplier: number;
  ratePerStock: number;
  volumeB20: number;
  pricePoints: PricePoint[];
  isGraduated: boolean;
}

type Timeframe = '1H' | '24H' | '7D' | 'ALL';

export function PriceChart({
  tokenSymbol,
  stockSymbol,
  stockPriceUsd,
  multiplier,
  ratePerStock,
  volumeB20,
  pricePoints,
  isGraduated,
}: PriceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const [displayMode, setDisplayMode] = useState<'USD' | 'STOCK'>('USD');
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    price: number;
    time: string;
  } | null>(null);

  const data = useMemo(() => {
    if (pricePoints && pricePoints.length >= 2) {
      return pricePoints;
    }
    const spotB20 = ratePerStock > 0 ? 1 / ratePerStock : 0;
    const spotUsd = spotB20 * stockPriceUsd * multiplier;
    return [
      { time: 'Launch', priceB20: spotB20, priceUsd: spotUsd },
      { time: 'Now', priceB20: spotB20, priceUsd: spotUsd },
    ];
  }, [pricePoints, ratePerStock, stockPriceUsd, multiplier]);

  const activePrices = useMemo(() => {
    return data.map((d) => (displayMode === 'USD' ? d.priceUsd : d.priceB20));
  }, [data, displayMode]);

  const currentPrice = activePrices[activePrices.length - 1] || 0;
  const startPrice = activePrices[0] || currentPrice;
  const priceChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;
  const isPositive = priceChange >= 0;

  const minPrice = Math.min(...activePrices);
  const maxPrice = Math.max(...activePrices);
  const priceRange = maxPrice - minPrice;

  const width = 560;
  const height = 200;
  const paddingX = 10;
  const paddingY = 22;

  const points = activePrices.map((price, idx) => {
    const x = paddingX + (idx / Math.max(1, activePrices.length - 1)) * (width - 2 * paddingX);
    const y =
      priceRange > 0
        ? height - paddingY - ((price - minPrice) / priceRange) * (height - 2 * paddingY)
        : height / 2;
    return { x, y, price, time: data[idx].time };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const volumeUsd = volumeB20 * stockPriceUsd;

  return (
    <SpotlightCard className="p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start space-x-3">
          <TokenEmblem symbol={tokenSymbol} size="md" />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-display font-semibold text-white text-lg tracking-tight">
                ${tokenSymbol} <span className="text-muted font-normal">/ {stockSymbol}</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-micro bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/30">
                {isGraduated ? 'v4 Pool Live' : 'On-Chain Curve'}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mt-1">
              <span className="font-mono text-xl sm:text-[26px] font-semibold text-white tabular-nums tracking-tight break-all">
                {displayMode === 'USD'
                  ? `$${currentPrice.toFixed(8)}`
                  : `${currentPrice.toFixed(10)} ${stockSymbol}`}
              </span>
              <span
                className={`text-xs font-mono font-medium flex items-center tabular-nums ${
                  isPositive ? 'text-[#00E599]' : 'text-red-400'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
                )}
                {isPositive ? '+' : ''}
                {priceChange.toFixed(2)}%
              </span>
            </div>

            <div className="font-mono text-[11px] text-muted mt-0.5 tabular-nums">
              {displayMode === 'USD' ? (
                <span>
                  1 {tokenSymbol} ≈{' '}
                  {(stockPriceUsd * multiplier > 0
                    ? currentPrice / (stockPriceUsd * multiplier)
                    : 0
                  ).toFixed(10)}{' '}
                  {stockSymbol}
                </span>
              ) : (
                <span>
                  1 {tokenSymbol} ≈ ${(currentPrice * stockPriceUsd * multiplier).toFixed(8)} USD
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Display Unit & Timeframe Switchers */}
        <div className="flex items-center space-x-2 self-start">
          <div className="flex bg-[#080B10] border border-white/[0.08] rounded-lg p-0.5 text-[11px]">
            {(['USD', 'STOCK'] as const).map((mode) => {
              const active = displayMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setDisplayMode(mode)}
                  className={`relative px-2.5 py-1 rounded-md font-medium transition-colors ${
                    active ? 'text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="chart-unit-pill"
                      transition={snappySpring}
                      className="absolute inset-0 rounded-md bg-[#0052FF]"
                    />
                  )}
                  <span className="relative z-10">{mode === 'USD' ? 'USD' : stockSymbol}</span>
                </button>
              );
            })}
          </div>

          <div className="flex bg-[#080B10] border border-white/[0.08] rounded-lg p-0.5 text-[11px] font-mono">
            {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => {
              const active = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`relative px-2 py-1 rounded-md transition-colors ${
                    active ? 'text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="chart-tf-pill"
                      transition={snappySpring}
                      className="absolute inset-0 rounded-md bg-[#192331]"
                    />
                  )}
                  <span className="relative z-10">{tf}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative w-full h-[200px] select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="bullStrokeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0052FF" />
              <stop offset="100%" stopColor="#00E599" />
            </linearGradient>
            <linearGradient id="bullFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00E599" stopOpacity="0.24" />
              <stop offset="55%" stopColor="#0052FF" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#080B10" stopOpacity="0" />
            </linearGradient>
          </defs>

          <line
            x1="0"
            y1={paddingY}
            x2={width}
            y2={paddingY}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 4"
          />
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 4"
          />
          <line
            x1="0"
            y1={height - paddingY}
            x2={width}
            y2={height - paddingY}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 4"
          />

          <path d={areaD} fill="url(#bullFillGrad)" />
          <path
            d={pathD}
            fill="none"
            stroke="url(#bullStrokeGrad)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {hoveredPoint && (
            <>
              <line
                x1={hoveredPoint.x}
                y1={0}
                x2={hoveredPoint.x}
                y2={height}
                stroke="rgba(0, 229, 153, 0.45)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="4.5"
                fill="#00E599"
                stroke="#080B10"
                strokeWidth="2"
              />
            </>
          )}

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

        {hoveredPoint && (
          <div
            className="absolute -top-3 pointer-events-none transform -translate-x-1/2 bg-[#080B10] border border-[#00E599]/45 text-white rounded-lg px-2.5 py-1 text-[11px] font-mono shadow-xl z-20 whitespace-nowrap"
            style={{
              left: `clamp(64px, ${(hoveredPoint.x / width) * 100}%, calc(100% - 64px))`,
            }}
          >
            <div className="font-semibold text-[#00E599] tabular-nums">
              {displayMode === 'USD'
                ? `$${hoveredPoint.price.toFixed(8)}`
                : `${hoveredPoint.price.toFixed(10)} ${stockSymbol}`}
            </div>
            <div className="text-[10px] text-muted">{hoveredPoint.time}</div>
          </div>
        )}
      </div>

      {/* Metrics Footer */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.07] text-xs">
        <div>
          <span className="text-[10px] uppercase tracking-micro text-muted block">Period High</span>
          <span className="font-mono font-medium text-ink tabular-nums mt-0.5 block truncate">
            {displayMode === 'USD' ? `$${maxPrice.toFixed(8)}` : `${maxPrice.toFixed(10)}`}
          </span>
        </div>
        <div className="text-right sm:text-center">
          <span className="text-[10px] uppercase tracking-micro text-muted block">Period Low</span>
          <span className="font-mono font-medium text-ink tabular-nums mt-0.5 block truncate">
            {displayMode === 'USD' ? `$${minPrice.toFixed(8)}` : `${minPrice.toFixed(10)}`}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:text-right">
          <span className="text-[10px] uppercase tracking-micro text-muted block">On-Chain Volume</span>
          <span className="font-mono font-medium text-[#00E599] tabular-nums mt-0.5 block">
            {volumeB20.toFixed(2)} {stockSymbol} (${volumeUsd.toFixed(2)})
          </span>
        </div>
      </div>
    </SpotlightCard>
  );
}
