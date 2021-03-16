import express from 'express'
import * as path from 'path'
import * as os from 'os'

let app

const CUSTOM_HEADERS = {
  "Content-Security-Policy": "script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self';"
}

export async function start ({port, configDir, domain}) {
  configDir = configDir || path.join(os.homedir(), '.ctznry')

  app = express()

  const staticDir = (path) => (
    express.static(path, {
      setHeaders: (res) => {
        for (let k in CUSTOM_HEADERS) {
          res.setHeader(k, CUSTOM_HEADERS[k])
        }
      }
    })
  )
  const staticFile = (path, opts) => (req, res) => {
    for (let k in CUSTOM_HEADERS) {
      res.setHeader(k, CUSTOM_HEADERS[k])
    }
    res.sendFile(path, {root: process.cwd(), cacheControl: opts?.cacheControl})
  }

  app.get('/', staticFile('./static/index.html'))
  app.get('/manifest.json', staticFile('./static/manifest.json'))
  // for the dev server, just serve the SW template
  app.get('/service-worker.js', staticFile('./static/service-worker-template.js', {cacheControl: false}))
  app.use('/img', staticDir('static/img'))
  app.use('/css', staticDir('static/css'))
  app.get('/js/:filename([^\.]+).build.js', (req, res) => {
    // for the dev server, just serve the non-built assets
    res.sendFile(`static/js/${req.params.filename}.js`, {root: process.cwd()})
  })
  app.use('/js', staticDir('static/js'))
  app.use('/vendor', staticDir('static/vendor'))
  app.use('/webfonts', staticDir('static/webfonts'))
  app.get('/signup', staticFile('static/index.html'))
  app.get('/forgot-password', staticFile('static/index.html'))
  app.get('/notifications', staticFile('static/index.html'))
  app.get('/communities', staticFile('static/index.html'))
  app.get('/account', staticFile('static/index.html'))
  app.get('/profile', staticFile('static/index.html'))
  app.get('/search', staticFile('static/index.html'))
  app.get('/:username([^\/]{3,})/ctzn.network/post/:key', staticFile('static/index.html'))
  app.get('/:username([^\/]{3,})/ctzn.network/comment/:key', staticFile('static/index.html'))
  app.get('/:username([^\/]{3,})/:subview', staticFile('static/index.html'))
  app.get('/:username([^\/]{3,})', staticFile('static/index.html'))

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