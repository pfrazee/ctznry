import express from 'express'
import * as path from 'path'
import * as os from 'os'

let app

export async function start ({port, configDir, domain}) {
  configDir = configDir || path.join(os.homedir(), '.ctznry')

  app = express()

  const staticFile = (path) => (req, res) => res.sendFile(path, {root: process.cwd()})

  app.get('/', staticFile('./static/index.html'))
  app.get('/manifest.json', staticFile('./static/manifest.json'))
  // for the dev server, just serve the SW template
  app.get('/service-worker.js', staticFile('./static/service-worker-template.js'))
  app.use('/img', express.static('static/img'))
  app.use('/css', express.static('static/css'))
  app.get('/js/:filename([^\.]+).build.js', (req, res) => {
    // for the dev server, just serve the non-built assets
    res.sendFile(`static/js/${req.params.filename}.js`, {root: process.cwd()})
  })
  app.use('/js', express.static('static/js'))
  app.use('/vendor', express.static('static/vendor'))
  app.use('/webfonts', express.static('static/webfonts'))
  app.get('/signup', staticFile('static/signup.html'))
  app.get('/forgot-password', staticFile('static/forgot-password.html'))
  app.get('/notifications', staticFile('static/notifications.html'))
  app.get('/communities', staticFile('static/communities.html'))
  app.get('/account', staticFile('static/account.html'))
  app.get('/profile', staticFile('static/user.html'))
  app.get('/search', staticFile('static/search.html'))
  app.get('/:username([^\/]{3,})/ctzn.network/post/:key', staticFile('static/post.html'))
  app.get('/:username([^\/]{3,})/ctzn.network/comment/:key', staticFile('static/comment.html'))
  app.get('/:username([^\/]{3,})', staticFile('static/user.html'))

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