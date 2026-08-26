/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // CompliNow brand palette — matches the logo mark exactly
        brand: {
          50:  '#EEF2FA',  // Cloud — light backgrounds
          100: '#DCE8F8',  // active tile tint
          200: '#B3C5E0',  // subtle text on dark
          300: '#7A8EB0',  // Mist — secondary text on dark surfaces
          400: '#4A6A96',  // mid-tone
          500: '#2D4E8A',  // focus rings
          600: '#1B3260',  // Brand Navy — primary nav surface
          700: '#162A52',  // hover / border on dark
          800: '#1B3260',  // sidebar / hero bg (alias of 600)
          900: '#07142A',  // Deep Navy — darkest surface
        },
        teal: {
          50:  '#E6FFF9',
          100: '#B3FFEE',
          200: '#66EDD6',
          300: '#33E4C8',
          400: '#00C4A0',  // Now Teal — primary CTA accent
          500: '#00917A',  // Teal Deep — hover
          600: '#006B5A',
        },
      },
    },
  },
  plugins: [],
}
