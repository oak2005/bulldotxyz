'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PricePoint } from '../context/ProtocolContext';

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
  const [displayMode, setDisplayMode] = useState<'STOCK' | 'USD'>('USD');
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

  const width = 500;
  const height = 180;
  const paddingX = 10;
  const paddingY = 20;

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
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-xl space-y-4">
      {/* Header: Token pair & Dual price headline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <span className="font-bold text-white text-base">
              ${tokenSymbol} / {stockSymbol}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary border border-primary/40 font-semibold">
              {isGraduated ? 'v4 Pool Live' : 'On-Chain Curve'}
            </span>
          </div>

          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-extrabold text-white">
              {displayMode === 'USD'
                ? `$${currentPrice.toFixed(8)}`
                : `${currentPrice.toFixed(10)} ${stockSymbol}`}
            </span>
            <span
              className={`text-xs font-semibold flex items-center ${
                isPositive ? 'text-success' : 'text-danger'
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
              )}
              {isPositive ? '+' : ''}
              {priceChange.toFixed(2)}%
            </span>
          </div>

          <div className="text-[11px] text-gray-400 mt-0.5">
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

        {/* Controls: Display Mode & Timeframe */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-background border border-border rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setDisplayMode('USD')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                displayMode === 'USD'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Show prices in USD"
            >
              USD ($)
            </button>
            <button
              onClick={() => setDisplayMode('STOCK')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                displayMode === 'STOCK'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
              title={`Show prices in ${stockSymbol}`}
            >
              {stockSymbol}
            </button>
          </div>

          <div className="flex bg-background border border-border rounded-lg p-0.5 text-xs">
            {(['1H', '24H', '7D', 'ALL'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded-md font-medium transition-all ${
                  timeframe === tf
                    ? 'bg-surface-hover text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
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

          <line
            x1="0"
            y1={paddingY}
            x2={width}
            y2={paddingY}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={height - paddingY}
            x2={width}
            y2={height - paddingY}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 3"
          />

          <path d={areaD} fill="url(#priceGradient)" />
          <path
            d={pathD}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
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
            className="absolute -top-3 pointer-events-none transform -translate-x-1/2 bg-background border border-primary/50 text-white rounded-lg px-2.5 py-1 text-[11px] shadow-lg shadow-black/60 z-20"
            style={{ left: `${(hoveredPoint.x / width) * 100}%` }}
          >
            <div className="font-bold">
              {displayMode === 'USD'
                ? `$${hoveredPoint.price.toFixed(8)}`
                : `${hoveredPoint.price.toFixed(10)} ${stockSymbol}`}
            </div>
            <div className="text-[10px] text-gray-400">{hoveredPoint.time}</div>
          </div>
        )}
      </div>

      {/* On-Chain Metrics Ticker */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/80 text-center text-xs">
        <div>
          <span className="text-[11px] text-gray-400 block">Period High</span>
          <span className="font-semibold text-gray-200">
            {displayMode === 'USD' ? `$${maxPrice.toFixed(8)}` : `${maxPrice.toFixed(10)}`}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-gray-400 block">Period Low</span>
          <span className="font-semibold text-gray-200">
            {displayMode === 'USD' ? `$${minPrice.toFixed(8)}` : `${minPrice.toFixed(10)}`}
          </span>
        </div>
        <div>
          <span className="text-[11px] text-gray-400 block">On-Chain Volume</span>
          <span className="font-semibold text-primary">
            {volumeB20.toFixed(2)} {stockSymbol} (~${volumeUsd.toFixed(2)})
          </span>
        </div>
      </div>
    </div>
  );
}
