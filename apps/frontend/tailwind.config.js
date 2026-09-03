/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  // Theme is driven by a `dark` class on <html>, matching ReachInbox's
  // light / dark / system behaviour.
  darkMode: 'class',

  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },

      /**
       * Semantic tokens only. Every colour resolves to a CSS variable defined in
       * index.css, so a component written once renders correctly in both themes
       * without `dark:` variants scattered through the markup.
       */
      colors: {
        // Backgrounds, from furthest back to most raised.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover) / <alpha-value>)',
        },

        // Foreground text.
        fg: {
          DEFAULT: 'rgb(var(--fg) / <alpha-value>)',
          muted: 'rgb(var(--fg-muted) / <alpha-value>)',
          subtle: 'rgb(var(--fg-subtle) / <alpha-value>)',
          onAccent: 'rgb(var(--fg-on-accent) / <alpha-value>)',
        },

        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },

        // Brand accent.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },

        // Status tones, each with a soft background and readable foreground.
        success: {
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
          fg: 'rgb(var(--success-fg) / <alpha-value>)',
          solid: 'rgb(var(--success-solid) / <alpha-value>)',
        },
        warning: {
          soft: 'rgb(var(--warning-soft) / <alpha-value>)',
          fg: 'rgb(var(--warning-fg) / <alpha-value>)',
          solid: 'rgb(var(--warning-solid) / <alpha-value>)',
        },
        danger: {
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          fg: 'rgb(var(--danger-fg) / <alpha-value>)',
          solid: 'rgb(var(--danger-solid) / <alpha-value>)',
        },
        info: {
          soft: 'rgb(var(--info-soft) / <alpha-value>)',
          fg: 'rgb(var(--info-fg) / <alpha-value>)',
          solid: 'rgb(var(--info-solid) / <alpha-value>)',
        },
      },

      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },

      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.16)',
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.12), 0 4px 12px -2px rgb(0 0 0 / 0.16)',
        card: '0 1px 3px 0 rgb(0 0 0 / 0.14), 0 8px 24px -8px rgb(0 0 0 / 0.20)',
        lift: '0 2px 4px 0 rgb(0 0 0 / 0.14), 0 16px 40px -12px rgb(0 0 0 / 0.30)',
        popover: '0 8px 16px -4px rgb(0 0 0 / 0.20), 0 24px 56px -16px rgb(0 0 0 / 0.40)',
        drawer: '-24px 0 64px -16px rgb(0 0 0 / 0.40)',
        glow: 'inset 0 1px 0 0 rgb(255 255 255 / 0.14)',
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
        display: ['2.5rem', { lineHeight: '1.08', letterSpacing: '-0.035em' }],
      },

      spacing: {
        sidebar: '15rem',
        topbar: '3.5rem',
      },

      backgroundImage: {
        'accent-gradient':
          'linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent-alt)) 100%)',
        mesh:
          'radial-gradient(at 15% 20%, rgb(var(--accent) / 0.9) 0px, transparent 55%), radial-gradient(at 85% 15%, rgb(var(--accent-alt) / 0.8) 0px, transparent 50%), radial-gradient(at 55% 95%, rgb(var(--accent) / 0.7) 0px, transparent 55%)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },

      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'scale-in': 'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 300ms cubic-bezier(0.16, 1, 0.3, 1) backwards',
        float: 'float 7s ease-in-out infinite',
      },

      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
