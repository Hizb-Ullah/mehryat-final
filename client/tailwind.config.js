export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f0d0c",
        espresso: "#2e1f16",
        cognac: "#a9713f",
        gold: "#7a1f2f",       // repurposed: was gold accent, now Jafferjees-style maroon
        parchment: "#ffffff",  // repurposed: was warm cream, now pure white like the reference site
        mist: "#f5f4f2",       // new: light-grey surface for footer / alternating sections
        stone: "#8a8078",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'Manrope'", "sans-serif"],
      },
      letterSpacing: { widest2: "0.25em" },
    },
  },
  plugins: [],
};
