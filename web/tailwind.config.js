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
        background: '#090B0E',
        surface: '#11151B',
        'surface-hover': '#181E27',
        border: '#1F2633',
        primary: {
          DEFAULT: '#0052FF', // Base Blue
          hover: '#0045D8',
          light: '#E6EFFF',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
};

