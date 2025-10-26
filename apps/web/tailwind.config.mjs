/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeOut: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        zoomIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        zoomOut: {
          from: { opacity: "1", transform: "scale(1)" },
          to: { opacity: "0", transform: "scale(0.95)" },
        },
        slideIn: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        slideOut: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-100%)" },
        },
        slideInFromRight: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        slideOutToRight: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        slideInFromTop: {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        slideOutToTop: {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(-100%)" },
        },
        slideInFromBottom: {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        slideOutToBottom: {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s ease-out",
        "collapsible-up": "collapsible-up 0.2s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "fade-out": "fadeOut 0.2s ease-out",
        "zoom-in": "zoomIn 0.2s ease-out",
        "zoom-out": "zoomOut 0.2s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-out": "slideOut 0.3s ease-out",
        "slide-in-from-right": "slideInFromRight 0.3s ease-out",
        "slide-out-to-right": "slideOutToRight 0.3s ease-out",
        "slide-in-from-top": "slideInFromTop 0.3s ease-out",
        "slide-out-to-top": "slideOutToTop 0.3s ease-out",
        "slide-in-from-bottom": "slideInFromBottom 0.3s ease-out",
        "slide-out-to-bottom": "slideOutToBottom 0.3s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
