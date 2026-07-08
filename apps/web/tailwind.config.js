/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(240 4% 16%)',
        background: 'hsl(240 10% 4%)',
        card: 'hsl(240 6% 10%)',
        foreground: 'hsl(0 0% 98%)',
        muted: 'hsl(240 5% 65%)',
        primary: 'hsl(142 71% 45%)',
        accent: 'hsl(38 92% 50%)',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
