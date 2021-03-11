import { parseUserId, joinPath } from './strings.js'

export const DEBUG_ENDPOINTS = {
  'dev1.localhost': 'localhost:15001',
  'dev2.localhost': 'localhost:15002',
  'dev3.localhost': 'localhost:15003',
  'dev4.localhost': 'localhost:15004'
}

export function HTTP_ENDPOINT (domain) {
  return DEBUG_ENDPOINTS[domain] ? `http://${DEBUG_ENDPOINTS[domain]}` : `https://${domain}`
}

export function AVATAR_URL (userId) {
  const {domain, username} = parseUserId(userId)
  return joinPath(HTTP_ENDPOINT(domain), '.view/ctzn.network/avatar-view', username)
}

export function POST_URL (post) {
  return '/' + joinPath(post.author.userId, 'ctzn.network/post', post.key)
}

export function FULL_POST_URL (post) {
  return location.origin + '/' + joinPath(post.author.userId, 'ctzn.network/post', post.key)
}

export function COMMENT_URL (comment) {
  return '/' + joinPath(comment.author.userId, 'ctzn.network/comment', comment.key)
}

export function FULL_COMMENT_URL (comment) {
  return location.origin + '/' + joinPath(comment.author.userId, 'ctzn.network/comment', comment.key)
}

export function BLOB_URL (userId, blobName) {
  const {domain, username} = parseUserId(userId)
  return joinPath(HTTP_ENDPOINT(domain), '.view/ctzn.network/blob-view', userId, blobName)
}

export const PERM_DESCRIPTIONS = {
  'ctzn.network/perm-community-ban': `Can remove, ban, and unban members from a community.`,
  'ctzn.network/perm-community-remove-post': `Can remove posts from the community.`,
  'ctzn.network/perm-community-remove-comment': `Can remove comments from the community.`,
  'ctzn.network/perm-community-edit-profile': `Can edit the profile of the community.`,
  'ctzn.network/perm-community-manage-roles': `Can create, edit, and delete roles.`,
  'ctzn.network/perm-community-assign-roles': `Can assign roles to community members.`
}

export const SUGGESTED_REACTIONS = [
  'like',
  'haha',
  'woah',
  'cool',
  'oh no!',
  'aww',
  'yes',
  'no',
  'ok!'
]