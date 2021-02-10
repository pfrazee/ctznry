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
  return joinPath(HTTP_ENDPOINT(domain), 'ctzn/avatar', username)
}