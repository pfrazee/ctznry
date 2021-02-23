import express from 'express'
import * as path from 'path'
import * as os from 'os'

let app

export async function start ({port, configDir, domain}) {
  configDir = configDir || path.join(os.homedir(), '.ctznry')

  app = express()
  app.set('view engine', 'ejs')

  app.get('/', (req, res) => {
    res.render('index')
  })

  app.use('/img', express.static('static/img'))
  app.use('/css', express.static('static/css'))
  app.use('/js', express.static('static/js'))
  app.use('/vendor', express.static('static/vendor'))
  app.use('/webfonts', express.static('static/webfonts'))

  app.get('/signup', (req, res) => {
    res.render('signup')
  })

  app.get('/forgot-password', (req, res) => {
    res.render('forgot-password')
  })

  app.get('/notifications', (req, res) => {
    res.render('notifications')
  })

  app.get('/profile', (req, res) => {
    res.render('user')
  })

  app.get('/search', (req, res) => {
    res.render('search')
  })

  app.get('/:username([^\/]{3,})/ctzn.network/post/:key', (req, res) => {
    res.render('post')
  })

  app.get('/:username([^\/]{3,})', (req, res) => {
    res.render('user')
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