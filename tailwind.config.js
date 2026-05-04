/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        aethera: {
          bg: "#0a0a0f",
          surface: "#13131a",
          border: "rgba(255,255,255,0.1)",
          text: "#ffffff",
          muted: "rgba(255,255,255,0.5)",
          accent: "#a78bfa",
        },
      },
    },
  },
  plugins: [],
};
