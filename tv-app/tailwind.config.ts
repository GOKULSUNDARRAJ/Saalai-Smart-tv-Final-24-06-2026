import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        'tv-sm':   ['clamp(0.75rem, 1.3vw, 1.5rem)',  { lineHeight: '1.4' }],
        'tv-base': ['clamp(0.9rem,  1.6vw, 1.75rem)', { lineHeight: '1.4' }],
        'tv-lg':   ['clamp(1.1rem,  1.8vw, 2rem)',    { lineHeight: '1.4' }],
        'tv-xl':   ['clamp(1.3rem,  2.2vw, 2.5rem)',  { lineHeight: '1.3' }],
        'tv-2xl':  ['clamp(1.5rem,  2.5vw, 3rem)',    { lineHeight: '1.2' }],
        'tv-3xl':  ['clamp(1.8rem,  3.2vw, 4rem)',    { lineHeight: '1.15' }],
      },
      spacing: {
        'safe': '5vw',
      },
      colors: {
        tv: {
          bg: '#0a0a0a',
          surface: '#1a1a1a',
          card: '#242424',
          focus: '#e50914',
          text: '#ffffff',
          muted: '#999999',
          overlay: 'rgba(0,0,0,0.7)',
        },
      },
      transitionDuration: {
        '150': '150ms',
      },
      boxShadow: {
        'focus': '0 0 0 4px #e50914',
        'focus-white': '0 0 0 4px #ffffff',
      },
    },
  },
  plugins: [],
} satisfies Config
