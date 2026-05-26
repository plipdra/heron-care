import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // Heron palette — see src/index.css for the raw values.
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          tint: 'var(--primary-tint)',
          foreground: 'var(--primary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        surface: 'var(--surface)',
        bg: 'var(--bg)',
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
        },
        line: 'var(--line)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        // shadcn aliases so generated components map onto the palette without edits.
        background: 'var(--bg)',
        foreground: 'var(--ink)',
        border: 'var(--line)',
        input: 'var(--line)',
        ring: 'var(--primary)',
        muted: {
          DEFAULT: 'var(--primary-tint)',
          foreground: 'var(--ink-muted)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: 'var(--primary-foreground)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
