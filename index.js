import express from 'express'
import * as path from 'path'
import * as os from 'os'

let app

export async function start ({port, configDir, domain}) {
  configDir = configDir || path.join(os.homedir(), '.ctznry')

  app = express()

  app.get('/', (req, res) => {
    res.sendFile('./static/index.html', {root: process.cwd()})
  })

  app.use('/img', express.static('static/img'))
  app.use('/css', express.static('static/css'))
  app.get('/js/:filename([^\.]+).build.js', (req, res) => {
    // for the dev server, just serve the non-built assets
    res.sendFile(`static/js/${req.params.filename}.js`, {root: process.cwd()})
  })
  app.use('/js', express.static('static/js'))
  app.use('/vendor', express.static('static/vendor'))
  app.use('/webfonts', express.static('static/webfonts'))

  app.get('/signup', (req, res) => {
    res.sendFile('static/signup.html', {root: process.cwd()})
  })

  app.get('/forgot-password', (req, res) => {
    res.sendFile('static/forgot-password.html', {root: process.cwd()})
  })

  app.get('/notifications', (req, res) => {
    res.sendFile('static/notifications.html', {root: process.cwd()})
  })

  app.get('/communities', (req, res) => {
    res.sendFile('static/communities.html', {root: process.cwd()})
  })

  app.get('/account', (req, res) => {
    res.sendFile('static/account.html', {root: process.cwd()})
  })

  app.get('/profile', (req, res) => {
    res.sendFile('static/user.html', {root: process.cwd()})
  })

  app.get('/search', (req, res) => {
    res.sendFile('static/search.html', {root: process.cwd()})
  })

  app.get('/:username([^\/]{3,})/ctzn.network/post/:key', (req, res) => {
    res.sendFile('static/post.html', {root: process.cwd()})
  })

  app.get('/:username([^\/]{3,})/ctzn.network/comment/:key', (req, res) => {
    res.sendFile('static/comment.html', {root: process.cwd()})
  })

  app.get('/:username([^\/]{3,})', (req, res) => {
    res.sendFile('static/user.html', {root: process.cwd()})
  })

  app.use((req, res) => {
    res.status(404).send('404 Page not found')
  })

  const server = await new Promise((resolve, reject) => {
    let s = app.listen(port, async () => {
      console.log(`CTZNRY server listening at http://localhost:${port}`)
      resolve()
    })
  })

  // process.on('SIGINT', close)
  // process.on('SIGTERM', close)
  // async function close () {
  //   console.log('Shutting down, this may take a moment...')
  //   await db.cleanup()
  //   server.close()
  // }

  return {
    server,
    close: async () => {
      console.log('Shutting down, this may take a moment...')
      server.close()
    }
  }
}