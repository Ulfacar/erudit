/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan the landing HTML. Tailwind v3 resolves content globs relative to the
  // CWD the CLI is run from (the project root), so point straight at public/.
  content: ['./public/landing.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
        display: ['Nunito', 'sans-serif'],
      },
      colors: {
        // Warm "Edukids" palette
        cream: '#FBF7F0',
        sand: '#F3EADB',
        ink: '#2B2A28',
        inksoft: '#5A554E',
        brandorange: '#F2994A',
        brandorangedk: '#E07B2E',
        brandgreen: '#7FB069',
        brandyellow: '#F6C453',
        brandteal: '#4FA3B0',
        brandred: '#EB6A5A',
        // soft tints for card backgrounds
        peach: '#FCE9D6',
        mint: '#E7F1DC',
        butter: '#FBEFC9',
        softblue: '#DDEEF1',
        blush: '#FBE2DC',
      },
      boxShadow: {
        soft: '0 18px 50px -22px rgba(43,42,40,0.25)',
        card: '0 10px 30px -12px rgba(43,42,40,0.18)',
        pop: '0 14px 0 0 rgba(43,42,40,0.08)',
      },
      borderRadius: {
        '4xl': '2.5rem',
        '5xl': '3rem',
      },
    },
  },
  plugins: [],
};
