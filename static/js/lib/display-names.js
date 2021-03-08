import { html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { asyncReplace } from '../../vendor/lit-element/lit-html/directives/async-replace.js'
import { getProfile } from './getters.js'
import { makeSafe } from './strings.js'
import { emojify } from './emojify.js'

let _activeFetches = {}

export function render (userId) {
  return asyncReplace(fetcher(userId))
}

export async function* fetcher (userId) {
  let displayName = get(userId)
  if (displayName) {
    yield displayName
    return
  }
  yield userId

  if (!_activeFetches[userId]) {
    _activeFetches[userId] = (async () => {
      let profile = await getProfile(userId).catch(e => undefined)
      return profile?.value?.displayName || userId
    })()
  }
  displayName = await _activeFetches[userId]
  yield html`${unsafeHTML(emojify(makeSafe(displayName)))}`
  set(userId, displayName)
}

export function get (userId) {
  sessionStorage.getItem(`dn:${userId}`)
}

export function set (userId, displayName) {
  sessionStorage.setItem(`dn:${userId}`, displayName)
}
