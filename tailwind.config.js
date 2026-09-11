/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        zblue: {
          50: '#eef9ff',
          100: '#d9f1ff',
          300: '#7dd8f7',
          400: '#3ec3ef',
          500: '#18abe0',
          600: '#0e86b8',
          700: '#0e6690',
        },
        zorange: {
          50: '#fff3ec',
          100: '#ffe1cf',
          300: '#ffab73',
          400: '#ff8c42',
          500: '#ff7a29',
          600: '#e8531b',
          700: '#c23f14',
        },
        znavy: {
          400: '#3b4a86',
          500: '#232f5e',
          600: '#1b2544',
          700: '#131a33',
          900: '#0b0f1e',
        },
        zink: '#10162b',
        zbg: '#f5f6fb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 40px -12px rgba(27, 37, 68, 0.18)',
        card: '0 4px 24px -4px rgba(16, 22, 43, 0.08)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        blob1: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(60px, -40px) scale(1.15)' },
          '66%': { transform: 'translate(-30px, 30px) scale(0.9)' },
        },
        blob2: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(-50px, 40px) scale(0.95)' },
          '66%': { transform: 'translate(40px, -30px) scale(1.1)' },
        },
        blob3: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(30px, 50px) scale(1.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        blob1: 'blob1 16s ease-in-out infinite',
        blob2: 'blob2 20s ease-in-out infinite',
        blob3: 'blob3 24s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
}
