/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#080B10',
        surface: '#0E141C',
        'surface-elevated': '#141C27',
        'surface-hover': '#192331',
        border: 'rgba(255, 255, 255, 0.08)',
        'border-strong': 'rgba(255, 255, 255, 0.14)',
        ink: '#F4F7FB',
        muted: '#8A96A8',
        primary: {
          DEFAULT: '#0052FF', // Base Blue
          hover: '#1A66FF',
          light: '#E6EFFF',
        },
        emeraldBrand: {
          DEFAULT: '#00E599', // Equity Mint Emerald
          dim: '#059669',
        },
        success: '#00E599',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        display: ['"Clash Display"', 'sans-serif'],
        sans: ['"Satoshi"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        display: '-0.03em',
        editorial: '-0.015em',
        micro: '0.12em',
      },
      boxShadow: {
        'base-glow': '0 4px 24px -4px rgba(0, 82, 255, 0.35)',
        'emerald-glow': '0 4px 24px -4px rgba(0, 229, 153, 0.25)',
        'tactile-card': '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 24px 48px -16px rgba(0,0,0,0.65)',
      },
    },
  },
  plugins: [],
};
