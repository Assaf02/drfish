import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:    { DEFAULT: '#0A1628', light: '#0D1F3C' },
        blue:    { DEFAULT: '#2E6DB4', light: '#4A9EFF' },
        teal:    { DEFAULT: '#00B4A6' },
        surface: '#F7F9FC',
        'gray-crm': { 50: '#EEF3FA', 100: '#D0DCE8', 400: '#8892A4' },
        success: { DEFAULT: '#1A7A4A', light: '#dcfce7' },
        warning: { DEFAULT: '#C05C00', light: '#fff3e0' },
        danger:  { DEFAULT: '#B91C1C', light: '#fee2e2' },
        royal:   { DEFAULT: '#2E6DB4', 50: '#dbeafe', 600: '#1c5a9e', 700: '#1a4f8a' },
      },
      fontFamily: {
        sans:    ["'Clash Display'", "'Plus Jakarta Sans'", 'system-ui', 'sans-serif'],
        display: ["'Clash Display'", "'Plus Jakarta Sans'", 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl:    '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      boxShadow: {
        card:         '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.10)',
        float:        '0 8px 30px rgba(0,0,0,0.12)',
        glow:         '0 0 20px rgba(46,109,180,0.25)',
        'input-focus':'0 0 0 4px rgba(10,22,40,0.08)',
        'login':      '0 32px 80px rgba(0,0,0,0.4)',
      },
      keyframes: {
        shimmer:  { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        fadeIn:   { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:  { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
        fishDraw: { from: { strokeDashoffset: '400' }, to: { strokeDashoffset: '0' } },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        shimmer:          'shimmer 1.6s linear infinite',
        'fade-in':        'fadeIn 0.25s cubic-bezier(0.25,0.46,0.45,0.94)',
        'slide-up':       'slideUp 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
        'scale-in':       'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        'gradient-shift': 'gradientShift 10s ease infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
