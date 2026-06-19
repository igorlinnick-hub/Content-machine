import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      animation: {
        gradient: "gradient 8s linear infinite",
        "shiny-text": "shiny-text 8s infinite",
        "blink-cursor": "blink-cursor 1s step-end infinite",
        meteor: "meteor 5s linear infinite",
        shine: "shine 8s ease-in-out infinite",
        "shimmer-slide": "shimmer-slide var(--speed,3s) ease-in-out infinite alternate",
        "spin-around": "spin-around calc(var(--speed,3s) * 2) infinite linear",
      },
      keyframes: {
        gradient: {
          to: { backgroundPosition: "200% center" },
        },
        "shiny-text": {
          "0%, 90%, 100%": { backgroundPosition: "calc(-100% - var(--shiny-width,100px)) 0" },
          "30%, 60%": { backgroundPosition: "calc(100% + var(--shiny-width,100px)) 0" },
        },
        "blink-cursor": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        meteor: {
          "0%": { transform: "rotate(var(--angle,215deg)) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": { transform: "rotate(var(--angle,215deg)) translateX(-600px)", opacity: "0" },
        },
        shine: {
          "0%": { backgroundPosition: "0% 0%" },
          "50%": { backgroundPosition: "100% 100%" },
          "100%": { backgroundPosition: "0% 0%" },
        },
        "shimmer-slide": {
          to: { transform: "translate(calc(100cqw - 100%), 0)" },
        },
        "spin-around": {
          "0%": { transform: "translateZ(0) rotate(0)" },
          "15%, 35%": { transform: "translateZ(0) rotate(90deg)" },
          "65%, 85%": { transform: "translateZ(0) rotate(270deg)" },
          "100%": { transform: "translateZ(0) rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
