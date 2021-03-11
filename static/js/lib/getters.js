import { DEBUG_ENDPOINTS } from './const.js'
import { joinPath } from './strings.js'
import * as session from './session.js'

export async function getProfile (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.view.get('ctzn.network/profile-view', userId)
  }
  return httpGet(domain, `.view/ctzn.network/profile-view/${encodeURIComponent(userId)}`)
}

export async function listUserFeed (userId, opts) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return (await session.api.view.get('ctzn.network/posts-view', userId, opts))?.posts
  }
  return (await httpGet(domain, `.view/ctzn.network/posts-view/${encodeURIComponent(userId)}`, opts))?.posts
}

export async function getPost (userId, key) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    if (key.startsWith('hyper://')) {
      return session.api.view.get('ctzn.network/post-view', key)
    }
    return session.api.view.get('ctzn.network/post-view', userId, key)
  }
  const username = getUsername(userId)
  key = toKey(key)
  return httpGet(domain, `.view/ctzn.network/post-view/${username}/${encodeURIComponent(key)}`)
}

export async function getComment (userId, key) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    if (key.startsWith('hyper://')) {
      return session.api.view.get('ctzn.network/comment-view', key)
    }
    return session.api.view.get('ctzn.network/comment-view', userId, key)
  }
  const username = getUsername(userId)
  key = toKey(key)
  return httpGet(domain, `.view/ctzn.network/comment-view/${username}/${encodeURIComponent(key)}`)
}

export async function getThread (authorId, subjectUrl, communityId = undefined) {
  const domain = getDomain(communityId || authorId)
  if (session.isActive(domain)) {
    return (await session.api.view.get('ctzn.network/thread-view', subjectUrl))?.comments
  }
  return (await httpGet(domain, `.view/ctzn.network/thread-view/${encodeURIComponent(subjectUrl)}`))?.comments
}

export async function listFollowers (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return session.api.view.get('ctzn.network/followers-view', userId)
  }
  let [mine, theirs] = await Promise.all([
    session.isActive() ? session.api.view.get('ctzn.network/followers-view', userId) : undefined,
    httpGet(domain, `/.view/ctzn.network/followers-view/${encodeURIComponent(userId)}`).catch(e => undefined)
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
    return (await session.api.table.list(userId, 'ctzn.network/follow'))?.entries
  }
  return (await httpGet(domain, `.table/${encodeURIComponent(userId)}/ctzn.network/follow`))?.entries
}

export async function listMembers (userId, opts) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return (await session.api.table.list(userId, 'ctzn.network/community-member', opts))?.entries
  }
  return (await httpGet(domain, `.table/${encodeURIComponent(userId)}/ctzn.network/community-member`, opts))?.entries
}

export async function listMemberships (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return (await session.api.table.list(userId, 'ctzn.network/community-membership'))?.entries
  }
  return (await httpGet(domain, `.table/${encodeURIComponent(userId)}/ctzn.network/community-membership`))?.entries
}

export async function listRoles (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return (await session.api.table.list(userId, 'ctzn.network/community-role'))?.entries
  }
  return (await httpGet(domain, `.table/${encodeURIComponent(userId)}/ctzn.network/community-role`))?.entries
}

export async function listBans (userId) {
  const domain = getDomain(userId)
  if (session.isActive(domain)) {
    return (await session.api.table.list(userId, 'ctzn.network/community-ban'))?.entries
  }
  return (await httpGet(domain, `.table/${encodeURIComponent(userId)}/ctzn.network/community-ban`))?.entries
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
    query = Object.fromEntries(Object.entries(query).filter(([k, v]) => typeof v !== 'undefined'))
    url += '?' + (new URLSearchParams(query)).toString()
  }
  return (await fetch(url)).json()
}