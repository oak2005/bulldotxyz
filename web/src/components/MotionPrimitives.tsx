'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { motion, HTMLMotionProps } from 'framer-motion';

export const snappySpring = {
  type: 'spring' as const,
  stiffness: 450,
  damping: 30,
  mass: 0.8,
};

export const gentleSpring = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 24,
};

export type TactileVariant = 'primary' | 'emerald' | 'secondary' | 'danger';

const VARIANT_STYLES: Record<TactileVariant, string> = {
  primary:
    'bg-[#0052FF] hover:bg-[#1A66FF] text-white shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_8px_24px_-6px_rgba(0,82,255,0.5)] border border-white/10',
  emerald:
    'bg-[#00E599] hover:bg-[#1FF0AA] text-[#05120D] font-bold shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_8px_24px_-6px_rgba(0,229,153,0.45)] border border-[#00E599]/40',
  secondary:
    'bg-[#141C27] hover:bg-[#192331] text-ink border border-white/[0.09] hover:border-white/[0.16]',
  danger:
    'bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60',
};

interface TactileButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: TactileVariant;
  className?: string;
}

export function TactileButton({
  children,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}: TactileButtonProps) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1.5, scale: 1.008 }}
      whileTap={disabled ? undefined : { y: 1, scale: 0.97 }}
      transition={snappySpring}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center rounded-xl font-medium transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function TactileLink({
  href,
  children,
  variant = 'primary',
  className = '',
  wrapperClassName = 'inline-block',
}: {
  href: string;
  children: React.ReactNode;
  variant?: TactileVariant;
  className?: string;
  wrapperClassName?: string;
}) {
  return (
    <Link href={href} className={wrapperClassName}>
      <motion.span
        whileHover={{ y: -1.5, scale: 1.008 }}
        whileTap={{ y: 1, scale: 0.97 }}
        transition={snappySpring}
        className={`relative inline-flex items-center justify-center rounded-xl font-medium transition-colors duration-150 ${VARIANT_STYLES[variant]} ${className}`}
      >
        {children}
      </motion.span>
    </Link>
  );
}

export function SpotlightCard({
  children,
  className = '',
  outerClassName = '',
  accent = 'mixed',
}: {
  children: React.ReactNode;
  className?: string;
  outerClassName?: string;
  accent?: 'blue' | 'emerald' | 'mixed';
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    setCoords((prev) => ({ ...prev, opacity: 0 }));
  };

  const spotlightBg =
    accent === 'blue'
      ? `radial-gradient(520px circle at ${coords.x}px ${coords.y}px, rgba(0, 82, 255, 0.12), transparent 45%)`
      : accent === 'emerald'
      ? `radial-gradient(520px circle at ${coords.x}px ${coords.y}px, rgba(0, 229, 153, 0.10), transparent 45%)`
      : `radial-gradient(520px circle at ${coords.x}px ${coords.y}px, rgba(0, 229, 153, 0.09), rgba(0, 82, 255, 0.06) 35%, transparent 55%)`;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E141C]/95 backdrop-blur-md shadow-tactile-card ${outerClassName}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: coords.opacity,
          background: spotlightBg,
        }}
      />
      <div className={`relative z-10 h-full ${className}`}>{children}</div>
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...gentleSpring, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

