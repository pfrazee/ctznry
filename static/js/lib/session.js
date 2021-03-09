import { DEBUG_ENDPOINTS } from './const.js'
import { create as createRpcApi } from './rpc-api.js'
import * as toast from '../com/toast.js'

let emitter = new EventTarget()
export let info = undefined
export let myCommunities = undefined
export let myFollowers = undefined
export let api = undefined

export async function setup () {
  let oldSessionInfo
  try {
    oldSessionInfo = JSON.parse(localStorage.getItem('session-info'))
    if (!oldSessionInfo) return

    const newApi = await connectApi(oldSessionInfo.domain)
    
    const newSessionInfo = await newApi.accounts.resumeSession(oldSessionInfo.sessionId)
    if (newSessionInfo) {
      info = Object.assign(oldSessionInfo, newSessionInfo)
      console.debug('Resumed session')
      localStorage.setItem('session-info', JSON.stringify(info))
      api = newApi
      emitter.dispatchEvent(new Event('change'))
      await loadSecondaryState()
    } else {
      throw new Error('Session not found')
    }
  } catch (e) {
    if (e.toString().includes('Connection failed')) {
      toast.create(`Failed to connect to your server at ${oldSessionInfo.domain}`, 'error')
    }
    console.error('Failed to resume API session')
    console.error(e)
  }

  // DEBUG
  window.api = api
}

export async function loadSecondaryState () {
  let [memberships, followers] = await Promise.all([
    api.communities.listMemberships(info.userId).catch(e => []),
    api.follows.listFollowers(info.userId).catch(e => [])
  ])
  myCommunities = memberships.map(m => m.value.community)
  myFollowers = getUniqFollowers(followers)
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
    await api.accounts.logout().catch(e => undefined) // ignore failures, we'll just abandon the session
  }
  localStorage.removeItem('session-info')
  info = undefined
  api = undefined
  emitter.dispatchEvent(new Event('change'))
}

export async function doSignup ({domain, username, displayName, description, avatar, email, password}) {
  const newApi = await connectApi(domain)
  const newSessionInfo = await newApi.accounts.register({
    username,
    displayName,
    description,
    email,
    password
  })
  if (newSessionInfo) {
    // override a couple items to be safe
    newSessionInfo.userId = `${username}@${domain}`
    newSessionInfo.username = username
    newSessionInfo.domain = domain

    if (avatar) {
      const avatarBase64 = avatar.split(',').pop()
      await newApi.profiles.putAvatar(avatarBase64).catch(e => console.log(e))
    }

    localStorage.setItem('session-info', JSON.stringify(newSessionInfo))
    info = newSessionInfo
    api = newApi
    emitter.dispatchEvent(new Event('change'))
  }
  return newSessionInfo
}

export async function doRequestPasswordChangeCode (userId) {
  const [username, domain] = userId.split('@')
  if (!username || !domain) {
    throw new Error('Invalid UserID: it should look like bob@ctzn.one')
  }
  const newApi = await connectApi(domain)
  await newApi.accounts.requestChangePasswordCode(username)
}

export async function doChangePasswordUsingCode (userId, passwordChangeCode, newPassword) {
  const [username, domain] = userId.split('@')
  if (!username || !domain) {
    throw new Error('Invalid UserID: it should look like bob@ctzn.one')
  }
  const newApi = await connectApi(domain)
  await newApi.accounts.changePasswordUsingCode(username, passwordChangeCode, newPassword)
}

export function hasOneSaved () {
  return !!localStorage.getItem('session-info')
}

export function getSavedInfo () {
  return JSON.parse(localStorage.getItem('session-info'))
}

export function isActive (domain = undefined) {
  if (!info || !api) return false
  if (domain && info.domain !== domain) return false
  return true
}

export function isInCommunity (communityUserId) {
  return !!myCommunities?.find?.(c => c.userId === communityUserId)
}

export function isFollowingMe (citizenUserId) {
  return !!myFollowers?.has?.(citizenUserId)
}

export function onChange (cb, opts) {
  emitter.addEventListener('change', cb, opts)
}

let _sessionRecoverPromise = undefined
async function connectApi (domain) {
  const wsEndpoint = (domain in DEBUG_ENDPOINTS) ? `ws://${DEBUG_ENDPOINTS[domain]}/` : `wss://${domain}/`
  return createRpcApi(wsEndpoint, async () => {
    if (_sessionRecoverPromise) return _sessionRecoverPromise
    if (api && hasOneSaved()) {
      // we still have a saved session, try to resume again
      _sessionRecoverPromise = new Promise(async (resolve) => {
        const newSessionInfo = await api.accounts.resumeSession(info.sessionId).catch(e => undefined)
        if (newSessionInfo) {
          Object.assign(info, newSessionInfo)
          console.debug('Recovered session')
          localStorage.setItem('session-info', JSON.stringify(info))
          resolve(true)
        } else {
          resolve(false)
        }
        _sessionRecoverPromise = undefined
      })
      return _sessionRecoverPromise
    }
  })
}

function getUniqFollowers (followers) {
  const s = new Set(followers.community.concat(followers.myCommunity || []).concat(followers.myFollowed || []))
  s.add(followers.subject.userId)
  return s
}