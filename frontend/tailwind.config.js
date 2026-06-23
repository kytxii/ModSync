/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Martian Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        body: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'appear': 'appear 0.5s ease-out forwards',
        'appear-zoom': 'appear-zoom 0.8s ease-out forwards',
        'ripple': 'ripple 0.6s ease-out forwards',
      },
      keyframes: {
        'appear': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'appear-zoom': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'ripple': {
          '0%': { transform: 'translate(-50%, -50%) scale(0)', opacity: '0.5' },
          '100%': { transform: 'translate(-50%, -50%) scale(25)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
