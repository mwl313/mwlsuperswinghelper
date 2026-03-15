/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#f8f2e6",
        pine: "#113c3a",
        ember: "#d94f30",
        sand: "#e7d5b8",
      },
      boxShadow: {
        card: "0 12px 32px rgba(17, 60, 58, 0.12)",
      },
      fontFamily: {
        display: ["'Nanum Gothic'", "'Apple SD Gothic Neo'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
