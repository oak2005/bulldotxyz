'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRightLeft,
  Rocket,
  Layers,
  Building2,
  Droplets,
} from 'lucide-react';
import { useProtocol } from '../context/ProtocolContext';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isSepolia, setIsFaucetOpen } = useProtocol();

  const navItems = [
    { label: 'Trade', href: '/', icon: ArrowRightLeft },
    { label: 'Launch', href: '/launch', icon: Rocket },
    { label: 'Explore', href: '/explore', icon: Layers },
    { label: 'Creator', href: '/dashboard', icon: Building2 },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              active
                ? 'text-primary font-bold bg-primary/10'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon className={`w-4 h-4 mb-0.5 ${active ? 'text-primary' : ''}`} />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}

      {isSepolia && (
        <button
          onClick={() => setIsFaucetOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors"
          title="Claim free testnet stocks"
        >
          <Droplets className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-semibold">Faucet</span>
        </button>
      )}
    </div>
  );
}

