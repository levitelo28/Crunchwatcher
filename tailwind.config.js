/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F5F1EA",
        paper: "#FFFDF8",
        ink: "#111111",
        muted: "#5F5A52",
        line: "#D8D0C4",
        stamp: "#2A2722",
        mint: "#111111",
        coral: "#111111",
        gold: "#111111"
      },
      boxShadow: {
        soft: "0 14px 32px rgba(17, 17, 17, 0.06)"
      }
    }
  },
  plugins: []
};
