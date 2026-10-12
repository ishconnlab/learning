/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary — IshConnect purple (#695BBE)
        brand: {
          50: '#F5F3F9',
          100: '#ECE8F4',
          200: '#CFC5E2',
          300: '#9F92B5',
          400: '#7E5E94',
          500: '#695BBE',
          600: '#5849A6',
          700: '#483858',
          800: '#3A2C49',
          900: '#2C2138',
          950: '#1C1424',
        },
        // Accent — IshConnect green (#01C82F)
        accent: {
          50: '#EAFBEF',
          100: '#E7F1EC',
          200: '#BEF0CE',
          300: '#7CDB99',
          400: '#3ED46A',
          500: '#01C82F',
          600: '#04A828',
          700: '#0A862B',
          800: '#0C6A26',
          900: '#0C5621',
        },
        // Supporting brand hues
        plum: {
          DEFAULT: '#A1666E',
          light: '#C8A6AB',
          dark: '#7A4A51',
        },
        ink: {
          DEFAULT: '#111827',
          soft: '#374151',
          muted: '#6B7280',
          faint: '#9CA3AF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8F8FB',
          sunken: '#F3F3F7',
          tint: '#E7F1EC',
        },
        line: '#E7E7EF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(30, 25, 56, 0.04), 0 8px 24px -12px rgba(46, 38, 86, 0.18)',
        focus: '0 0 0 3px rgba(105, 91, 190, 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        kenburns: {
          '0%': { transform: 'scale(1) translate(0, 0)' },
          '100%': { transform: 'scale(1.12) translate(-1.5%, -1.5%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        kenburns: 'kenburns 18s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};
