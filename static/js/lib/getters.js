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
    if (key.startsWith('hyper://')) {
      return session.api.posts.get(key)
    }
    return session.api.posts.get(userId, key)
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
  let [mine, theirs] = await Promise.all([
    session.isActive() ? session.api.follows.listFollowers(userId) : undefined,
    httpGet(domain, `/ctzn/followers/${encodeURIComponent(userId)}`).catch(e => undefined)
  ])
  if (!mine && !theirs) throw new Error('Failed to fetch any follower information')
  return {
    subject: theirs?.subject || mine.subject,
    community: theirs?.community,
    myCommunity: mine?.myCommunity,
    myFollowed: mine?.myFollowed
  }
}

export async function listFollows (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.follows.listFollows(userId)
  }
  return httpGet(domain, `/ctzn/follows/${encodeURIComponent(userId)}`)
}

export async function listMembers (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.communities.listMembers(userId)
  }
  return httpGet(domain, `/ctzn/members/${encodeURIComponent(userId)}`)
}

export async function listMemberships (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.communities.listMemberships(userId)
  }
  return httpGet(domain, `/ctzn/memberships/${encodeURIComponent(userId)}`)
}

export async function listRoles (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.communities.listRoles(userId)
  }
  return httpGet(domain, `/ctzn/roles/${encodeURIComponent(userId)}`)
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
  const origin = DEBUG_ENDPOINTS[domain] ? `http://${DEBUG_ENDPOINTS[domain]}/` : `https://${domain}/`
  let url = joinPath(origin, path)
  if (query) {
    url += '?' + (new URLSearchParams(query)).toString()
  }
  return (await fetch(url)).json()
}