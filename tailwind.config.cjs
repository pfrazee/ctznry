module.exports = {
  purge: {
    content: [
      './static/**/*.html',
      './static/**/*.js'
    ],
    options: {
      safelist: [
        'bg-red-50',
        'bg-pink-600',
        'hover:bg-pink-700',
        'border-pink-800',
        'text-green-700',
        'text-blue-700',
        'text-red-700',
        'bg-green-50',
        'bg-blue-50',
        'bg-red-50'
      ]
    }
  },
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