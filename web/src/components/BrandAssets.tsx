'use client';

import React from 'react';

export function BulldotLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="bulldot.xyz emblem"
    >
      <defs>
        <linearGradient id="bullGrad" x1="2" y1="2" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0052FF" />
          <stop offset="100%" stopColor="#00E599" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="#0E141C" />
      <rect x="0.75" y="0.75" width="34.5" height="34.5" rx="9.25" stroke="url(#bullGrad)" strokeWidth="1.5" />
      {/* Sharp architectural bull-horn geometric mark */}
      <path
        d="M8.5 11.5C8.5 15.8 11.4 18.8 14.5 19.6L16.2 26.5H19.8L21.5 19.6C24.6 18.8 27.5 15.8 27.5 11.5C25.2 13.7 22.8 14.8 19.6 15.1L18 13.2L16.4 15.1C13.2 14.8 10.8 13.7 8.5 11.5Z"
        fill="url(#bullGrad)"
      />
      <circle cx="18" cy="21" r="1.4" fill="#080B10" />
    </svg>
  );
}

export function BaseNetworkMark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Base Network"
    >
      <circle cx="12" cy="12" r="11" fill="#0052FF" />
      <path
        d="M12 18.2C15.4242 18.2 18.2 15.4242 18.2 12C18.2 8.57583 15.4242 5.8 12 5.8C8.76063 5.8 6.10164 8.28432 5.82353 11.45H13.9V12.55H5.82353C6.10164 15.7157 8.76063 18.2 12 18.2Z"
        fill="white"
      />
    </svg>
  );
}

export function UniswapMark({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Uniswap v4"
    >
      <circle cx="12" cy="12" r="10.5" fill="#0E141C" stroke="rgba(0, 229, 153, 0.45)" strokeWidth="1.2" />
      <path
        d="M7.5 14.5C9.5 14.5 10.5 11.5 12 9.5C13.5 7.5 15.5 7 16.8 6.8C15.9 8.6 15.6 10.8 16.5 13C15.2 12.6 13.7 13.4 13 15C12.3 16.5 10.2 17.2 7.5 14.5Z"
        stroke="#00E599"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StockEquityBadge({
  symbol,
  size = 'md',
}: {
  symbol: string;
  size?: 'sm' | 'md';
}) {
  const ticker = symbol.replace(/^b/, '');
  const accentMap: Record<string, string> = {
    bCOIN: 'from-[#0052FF]/25 to-[#0052FF]/5 border-[#0052FF]/45 text-[#699CFF]',
    bNVDA: 'from-[#00E599]/25 to-[#00E599]/5 border-[#00E599]/45 text-[#00E599]',
    bAAPL: 'from-slate-300/20 to-slate-500/5 border-white/25 text-ink',
    bTSLA: 'from-cyan-400/25 to-blue-600/5 border-cyan-400/40 text-cyan-300',
  };
  const cls = accentMap[symbol] || accentMap.bCOIN;
  const dims = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-[11px]';

  return (
    <div
      className={`${dims} rounded-xl bg-gradient-to-br ${cls} border flex items-center justify-center font-mono font-semibold tracking-tight shrink-0`}
    >
      {ticker.slice(0, 4)}
    </div>
  );
}

export function TokenEmblem({ symbol, size = 'md' }: { symbol: string; size?: 'sm' | 'md' | 'lg' }) {
  const letters = (symbol || 'TK').replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase();
  const dims =
    size === 'sm'
      ? 'w-7 h-7 text-[10px] rounded-lg'
      : size === 'lg'
      ? 'w-12 h-12 text-sm rounded-2xl'
      : 'w-9 h-9 text-xs rounded-xl';

  return (
    <div
      className={`${dims} bg-gradient-to-br from-[#0052FF]/30 via-[#0E141C] to-[#00E599]/25 border border-white/15 flex items-center justify-center font-display font-semibold text-white tracking-tight shrink-0 shadow-inner`}
    >
      {letters}
    </div>
  );
}

