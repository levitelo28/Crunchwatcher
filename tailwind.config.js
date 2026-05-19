/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F6F3ED",
        paper: "#FBF9F5",
        ink: "#111111",
        muted: "#5C5C5C",
        line: "rgba(0,0,0,0.08)",
        stamp: "#2A2722",
        mint: "#6F8064",
        coral: "#A76658",
        gold: "#B39558",
        charcoal: "#1F1D1A",
        dusk: "#2A2723"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(17, 17, 17, 0.08)",
        float: "0 10px 30px rgba(17, 17, 17, 0.06)"
      }
    }
  },
  plugins: []
};
