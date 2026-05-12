/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0f172a',
          panel: '#16213e',
          surface: '#1a1a2e',
          elevated: '#1e2a4a',
        },
        accent: {
          DEFAULT: '#0ea5e9',
          hover: '#0284c7',
        },
        warn: '#f59e0b',
        good: '#22c55e',
        bad: '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
