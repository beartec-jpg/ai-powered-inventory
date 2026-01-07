/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // BEAR TEC Brand Colors
        'bear': {
          50: '#f8f6f3',
          100: '#ede7e0',
          200: '#dcccc4',
          300: '#c4aaa0',
          400: '#a88975',
          500: '#8b6a52',
          600: '#704d3d',
          700: '#5a3d31',
          800: '#473029',
          900: '#3a2620',
          950: '#211411',
        },
        // Primary Brand Color (Deep Bear Brown)
        'primary': {
          50: '#f8f6f3',
          100: '#ede7e0',
          200: '#dcccc4',
          300: '#c4aaa0',
          400: '#a88975',
          500: '#8b6a52',
          600: '#704d3d',
          700: '#5a3d31',
          800: '#473029',
          900: '#3a2620',
        },
        // Secondary Brand Color (Gold Accent)
        'accent': {
          50: '#fffbf0',
          100: '#fff3dd',
          200: '#ffe5b4',
          300: '#ffd699',
          400: '#ffb84d',
          500: '#ff9a00',
          600: '#e67e00',
          700: '#cc6600',
          800: '#994d00',
          900: '#663300',
        },
        // Tertiary Brand Color (Teal - Modern Tech Touch)
        'teal': {
          50: '#f0fefb',
          100: '#dcfaf5',
          200: '#b3f3ea',
          300: '#7ee9dd',
          400: '#4bdcc8',
          500: '#2bc9b3',
          600: '#1da89d',
          700: '#1a8a82',
          800: '#186d6a',
          900: '#165957',
        },
        // Neutral Palette
        'neutral': {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292423',
          900: '#1c1917',
        },
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Poppins', 'sans-serif'],
      },
      spacing: {
        'xs': '0.5rem',
        'sm': '0.75rem',
        'md': '1rem',
        'lg': '1.5rem',
        'xl': '2rem',
        '2xl': '2.5rem',
        '3xl': '3rem',
      },
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(139, 106, 82, 0.05)',
        'md': '0 4px 6px -1px rgba(139, 106, 82, 0.1)',
        'lg': '0 10px 15px -3px rgba(139, 106, 82, 0.1)',
        'xl': '0 20px 25px -5px rgba(139, 106, 82, 0.1)',
        '2xl': '0 25px 50px -12px rgba(139, 106, 82, 0.15)',
        'inner': 'inset 0 2px 4px 0 rgba(139, 106, 82, 0.05)',
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#44403c',
            a: {
              color: '#8b6a52',
              '&:hover': {
                color: '#704d3d',
              },
            },
            h1: {
              color: '#3a2620',
            },
            h2: {
              color: '#3a2620',
            },
            h3: {
              color: '#3a2620',
            },
            strong: {
              color: '#3a2620',
            },
          },
        },
      },
    },
  },
  plugins: [],
}
