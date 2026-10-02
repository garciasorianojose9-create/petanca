/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "primary": "#d42111",
        "primary-dark": "#b01b0e",
        "primary-hover": "#b01b0d",
        "primary-light": "#fde8e6",
        "accent": "#f3c74c",
        "background-light": "#f8f6f6",
        "background-dark": "#221210",
        "surface-dark": "#2c1515",
        "neutral-tint": "#f3e8e7",
        "surface": "#ffffff",
        "gold": "#FFD700",
      },
      fontFamily: {
        "display": ["Inter", "sans-serif"],
        "sans": ["Inter", "sans-serif"]
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
}