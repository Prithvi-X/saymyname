import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/design-tokens/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        void: '#0B0D10',
        stage: '#0B0D10',
        coal: '#12161B',
        iron: '#1A2027',
        slate: '#252D37',
        edge: '#343D48',
        chalk: '#F0F1EE',
        silver: '#B6BDC4',
        ash: '#8B949E',
        iris: {
          DEFAULT: '#8580C4',
          hover: '#9894D1',
          subtle: '#1C1C2E',
          tint: '#27263E',
        },
        ember: {
          DEFAULT: '#E18A62',
          subtle: '#2D1F18',
        },
        success: {
          DEFAULT: '#77C5A1',
          subtle: '#13281E',
        },
        warning: {
          DEFAULT: '#E6BC69',
          subtle: '#2E2412',
        },
        danger: {
          DEFAULT: '#F07878',
          subtle: '#301618',
        },
      },
      fontFamily: {
        ui: ['Instrument Sans', 'sans-serif'],
        display: ['Instrument Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.4)',
        sm: '0 2px 4px rgba(0, 0, 0, 0.4)',
        md: '0 4px 12px rgba(0, 0, 0, 0.5)',
        lg: '0 12px 28px rgba(0, 0, 0, 0.6)',
      },
      borderRadius: {
        control: '8px',
        panel: '12px',
        surface: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
