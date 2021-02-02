import subcommand from 'subcommand'
import { start } from './index.js'

const match = subcommand({
  commands: [
    {
      name: 'start',
      command: args => {
        start({port: 4000})
      }
    },
  ],
  root: {
    command: args => {
      start({port: 4000})
    }
  }
})
const cmd = match(process.argv.slice(2))