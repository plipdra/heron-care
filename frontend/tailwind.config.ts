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
          // Derived ramp — heading hierarchy + the authoritative AI answer line.
          600: 'var(--primary-600)',
          800: 'var(--primary-800)',
          'tint-md': 'var(--primary-tint-md)',
          'tint-sm': 'var(--primary-tint-sm)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
          tint: 'var(--accent-tint)',
          deep: 'var(--accent-deep)',
        },
        // The AI moment's own surface + halo (derived from primary, no new hue).
        ai: {
          surface: 'var(--ai-surface)',
          glow: 'var(--ai-glow)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
        },
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
      // Blue-tinted, low-opacity elevation only — never gray-black (see src/index.css).
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        ai: 'var(--shadow-ai)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        // State-change motion only (BRAND.md §8.3) — each communicates something.
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up-sm': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'stagger-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Brand-tinted shimmer for the AI "thinking" skeleton — never gray.
        shimmer: {
          '0%': { 'background-position': '-400px 0' },
          '100%': { 'background-position': '400px 0' },
        },
        // Gentle breath on the AI loader — signals work in progress.
        'ai-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.94)' },
        },
        'banner-in': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // The AI loading header's lighter veil fades out so the bar visibly
        // deepens toward its final blue as the answer nears.
        'veil-fade': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'fade-out': 'fade-out 150ms ease-in',
        'slide-up': 'slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up-sm': 'slide-up-sm 200ms ease-out',
        'stagger-in': 'stagger-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'ai-pulse': 'ai-pulse 1.8s ease-in-out infinite',
        'banner-in': 'banner-in 240ms ease-out',
        'veil-fade': 'veil-fade 2.3s ease-out both',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
