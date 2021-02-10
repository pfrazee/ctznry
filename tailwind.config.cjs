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
        post: '45px 1fr',
        'post-tight': '34px 1fr',
        composer: '30px 1fr',
      }
    }
  },
  variants: {},
  plugins: [],
}