'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Rocket, Layers, Building2, BookOpen, Droplets } from 'lucide-react';
import { useProtocol } from '../context/ProtocolContext';
import { snappySpring } from './MotionPrimitives';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isSepolia, setIsFaucetOpen } = useProtocol();

  const navItems = [
    { label: 'Trade', href: '/', icon: ArrowRightLeft },
    { label: 'Launch', href: '/launch', icon: Rocket },
    { label: 'Pools', href: '/explore', icon: Layers },
    { label: 'Creator', href: '/dashboard', icon: Building2 },
    { label: 'Docs', href: '/docs', icon: BookOpen },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0E141C]/95 backdrop-blur-xl border-t border-white/[0.08] px-1.5 pt-1.5 pb-[max(0.45rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center py-1 px-1.5 sm:px-2.5 rounded-xl min-w-0"
          >
            {active && (
              <motion.span
                layoutId="mobile-bottom-pill"
                transition={snappySpring}
                className="absolute inset-0 rounded-xl bg-[#0052FF]/15 border border-[#0052FF]/40"
              />
            )}
            <Icon
              className={`relative z-10 w-4 h-4 mb-0.5 ${active ? 'text-[#5C93FF]' : 'text-muted'}`}
              strokeWidth={1.6}
            />
            <span className={`relative z-10 text-[10px] ${active ? 'text-white font-semibold' : 'text-muted'}`}>
              {item.label}
            </span>
          </Link>
        );
      })}

      {isSepolia && (
        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={snappySpring}
          onClick={() => setIsFaucetOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[#00E599] hover:text-white transition-colors"
          title="Claim free testnet stocks"
        >
          <Droplets className="w-4 h-4 mb-0.5" strokeWidth={1.75} />
          <span className="text-[10px] font-semibold">Faucet</span>
        </motion.button>
      )}
    </div>
  );
}
