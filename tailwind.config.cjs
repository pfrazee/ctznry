module.exports = {
  purge: [
    './static/**/*.html',
    './static/**/*.js'
  ],
  darkMode: 'media',
  theme: {
    extend: {
      gridTemplateColumns: {
        'layout-twocol': 'minmax(0, 1fr) 260px',
        composer: '30px 1fr',
      }
    }
  },
  variants: {},
  plugins: [],
}