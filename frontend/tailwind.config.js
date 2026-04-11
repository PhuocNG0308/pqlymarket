/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/js/**/*.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0e0e0e",
          dim: "#0e0e0e",
          bright: "#2c2c2c",
          container: {
            DEFAULT: "#1a1919",
            lowest: "#000000",
            low: "#131313",
            high: "#201f1f",
            highest: "#262626",
          },
          variant: "#262626",
          tint: "#ffa729",
        },
        primary: {
          DEFAULT: "#ffa729",
          dim: "#ea9613",
          container: "#e18e03",
          fixed: { DEFAULT: "#ffa729", dim: "#ea9613" },
        },
        secondary: {
          DEFAULT: "#feb726",
          dim: "#eea914",
          container: "#7e5700",
          fixed: { DEFAULT: "#ffc96d", dim: "#feb726" },
        },
        tertiary: {
          DEFAULT: "#fff7cf",
          dim: "#eddd47",
          container: "#fceb54",
          fixed: { DEFAULT: "#fceb54", dim: "#eddd47" },
        },
        error: {
          DEFAULT: "#ff7351",
          dim: "#d53d18",
          container: "#b92902",
        },
        outline: {
          DEFAULT: "#777575",
          variant: "#494847",
        },
        "on-surface": {
          DEFAULT: "#ffffff",
          variant: "#adaaaa",
        },
        "on-primary": {
          DEFAULT: "#4d2e00",
          container: "#351e00",
          fixed: { DEFAULT: "#2e1900", variant: "#593500" },
        },
        "on-secondary": {
          DEFAULT: "#553900",
          container: "#fff6ee",
          fixed: { DEFAULT: "#473000", variant: "#6c4a00" },
        },
        "on-tertiary": {
          DEFAULT: "#675e00",
          container: "#5e5600",
          fixed: { DEFAULT: "#4a4400", variant: "#696000" },
        },
        "on-error": {
          DEFAULT: "#450900",
          container: "#ffd2c8",
        },
        "on-background": "#ffffff",
        background: "#0e0e0e",
        "inverse-surface": "#fcf8f8",
        "inverse-on-surface": "#565554",
        "inverse-primary": "#875300",
      },
      fontFamily: {
        manrope: ["Manrope", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      letterSpacing: {
        tightest: "-0.02em",
      },
    },
  },
  plugins: [],
};
