import { DEBUG_ENDPOINTS } from './const.js'
import { joinPath } from './strings.js'
import * as session from './session.js'

export async function getProfile (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.profiles.get(userId)
  }
  return httpGet(domain, `/ctzn/profile/${encodeURIComponent(userId)}`)
}

export async function listUserFeed (userId, opts) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.posts.listUserFeed(userId, opts)
  }
  return httpGet(domain, `/ctzn/posts/${encodeURIComponent(userId)}`, opts)  
}

export async function getPost (userId, key) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.posts.get(key)
  }
  const username = getUsername(userId)
  key = toKey(key)
  return httpGet(domain, `/ctzn/post/${username}/${encodeURIComponent(key)}`)
}

export async function getThread (authorId, subjectUrl) {
  const domain = getDomain(authorId)
  if (session.isActive(domain)) {
    return session.api.posts.getThread(subjectUrl)
  }
  return httpGet(domain, `/ctzn/thread/${encodeURIComponent(subjectUrl)}`)
}

export async function listFollowers (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.follows.listFollowers(userId)
  }
  return httpGet(domain, `/ctzn/followers/${encodeURIComponent(userId)}`)
}

export async function listFollows (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.follows.listFollows(userId)
  }
  return httpGet(domain, `/ctzn/follows/${encodeURIComponent(userId)}`)
}

function getDomain (userId) {
  return userId.split('@')[1] || userId
}

function getUsername (userId) {
  return userId.split('@')[0] || userId
}

function toKey (key) {
  if (key.startsWith('hyper://')) {
    return key.split('/').slice(-1)[0]
  }
  return key
}

async function httpGet (domain, path, query = undefined) {
  const origin = DEBUG_ENDPOINTS[domain] ? `http://${DEBUG_ENDPOINTS[domain]}/` : `http://${domain}/`
  let url = joinPath(origin, path)
  if (query) {
    url += '?' + (new URLSearchParams(query)).toString()
  }
  return (await fetch(url)).json()
}