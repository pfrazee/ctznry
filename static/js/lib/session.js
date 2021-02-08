import { DEBUG_ENDPOINTS } from './const.js'
import { create as createRpcApi } from './rpc-api.js'

let emitter = new EventTarget()
export let info = undefined
export let myCommunities = undefined
export let api = undefined

export async function setup () {
  try {
    const oldSessionInfo = JSON.parse(localStorage.getItem('session-info'))
    if (!oldSessionInfo) return

    const newApi = await connectApi(oldSessionInfo.domain)
    
    const newSessionInfo = await newApi.accounts.resumeSession(oldSessionInfo.sessionId)
    if (newSessionInfo) {
      info = Object.assign(oldSessionInfo, newSessionInfo)
      console.debug('Resumed session', info)
      localStorage.setItem('session-info', JSON.stringify(info))
      api = newApi
      emitter.dispatchEvent(new Event('change'))

      myCommunities = await api.communities.listMemberships(info.userId).then(memberships => memberships.map(m => m.value.community))
    }
  } catch (e) {
    console.error('Failed to resume API session')
    console.error(e)
  }
}

export async function doLogin ({userId, password}) {
  const [username, domain] = userId.split('@')
  const newApi = await connectApi(domain)
  const newSessionInfo = await newApi.accounts.login({username, password})
  if (newSessionInfo) {
    // override a couple items to be safe
    newSessionInfo.userId = userId
    newSessionInfo.username = username
    newSessionInfo.domain = domain

    localStorage.setItem('session-info', JSON.stringify(newSessionInfo))
    info = newSessionInfo
    api = newApi
    emitter.dispatchEvent(new Event('change'))
  }
  return newSessionInfo
}

export async function doLogout () {
  if (info && api) {
    await api.accounts.logout()
    localStorage.removeItem('session-info')
    info = undefined
    api = undefined
    emitter.dispatchEvent(new Event('change'))
  }
}

export function isActive (domain = undefined) {
  if (!info || !api) return false
  if (domain && info.domain !== domain) return false
  return true
}

export function isInCommunity (communityUserId) {
  return !!myCommunities?.find(c => c.userId === communityUserId)
}

export function onChange (cb, opts) {
  emitter.addEventListener('change', cb, opts)
}

async function connectApi (domain) {
  const wsEndpoint = (domain in DEBUG_ENDPOINTS) ? `ws://${DEBUG_ENDPOINTS[domain]}/` : `ws://${domain}/`
  return createRpcApi(wsEndpoint)
}
