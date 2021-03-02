import * as rpcWebsockets from '../../vendor/rpc-websockets/bundle.js'

const SESSION_ERROR_CODE = -32001

export async function create (endpoint = 'ws://localhost:3000/', recoverSessionFn) {
  const ws = new rpcWebsockets.Client(endpoint)
  await new Promise(resolve => ws.on('open', resolve))
  const api = new Proxy({}, {
    get (target, prop) {
      // generate rpc calls as needed
      if (!(prop in target)) {
        target[prop] = new Proxy({}, {
          get (target, prop2) {
            if (!(prop2 in target)) {
              target[prop2] = async (...params) => {
                try {
                  // send call
                  return await ws.call(`${prop}.${prop2}`, params)
                } catch (e) {
                  if (e.code === SESSION_ERROR_CODE && recoverSessionFn) {
                    // session is missing, try to recover it
                    if (await recoverSessionFn()) {
                      // success, send the call again
                      try {
                        return await ws.call(`${prop}.${prop2}`, params)
                      } catch (e) {
                        throw new Error(e.data || e.message)
                      }
                    }
                  } else {
                    throw new Error(e.data || e.message)
                  }
                }
              }
            }
            return target[prop2]
          }
        })
      }

      return target[prop]
    }
  })

  return api
}