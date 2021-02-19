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
        post: '50px 1fr',
        'post-tight': '30px 65px 1fr',
        composer: '42px 1fr',
      }
    }
  },
  variants: {},
  plugins: [],
}