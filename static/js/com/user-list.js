import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import css from '../../css/com/user-list.css.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { getProfile, listFollowers, listFollows } from '../lib/getters.js'
import { makeSafe, linkify } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'

export class UserList extends LitElement {
  static get properties () {
    return {
      ids: {type: Array},
      profiles: {type: Array}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.ids = undefined
    this.profiles = undefined
  }

  async load () {
    this.profiles = []
    for (let id of this.ids) {
      const profile = await getProfile(id)
      if (profile.error) {
        profile.userId = id
      }
      this.profiles.push(profile)
      this.requestUpdate()
      
      if (profile.error) {
        continue
      }

      const [followers, following] = await Promise.all([
        listFollowers(id).catch(e => undefined),
        listFollows(id).catch(e => undefined)
      ])
      let uniqFollowers = followers ? getUniqFollowers(followers) : []
      profile.isFollowingMe = session.isActive() && !!following?.find(f => f.value.subject.userId === session.info.userId)
      profile.amIFollowing = session.isActive() && !!uniqFollowers?.find(f => f === session.info.userId)
      this.requestUpdate()
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('ids') && changedProperties.get('ids') != this.ids) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (!this.profiles) {
      return html`<span class="spinner"></span>`
    }
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <div class="profiles">
        ${repeat(this.profiles, profile => {
          if (profile.error) {
            return html`
              <div class="profile error">
                <div class="error-info">
                  <span class="fas fa-exclamation-circle"></span>
                  Failed to load profile
                </div>
                <div class="id">
                  <a class="username" href="/${profile.userId}" title=${profile.userId}>
                    ${profile.userId}
                  </a>
                </div>
                <div class="description">${profile.message}</div>
              </div>
            `
          }
          const userId = (new URL(profile.url)).pathname.split('/')[1]
          return html`
            <div class="profile">
              <div class="header">
                <a class="avatar" href="/${profile.userId}" title=${profile.value.displayName}>
                  <img src=${AVATAR_URL(profile.userId)}>
                </a>
                ${this.renderProfileControls(profile)}
              </div>
              <div class="id">
                <a class="display-name" href="/${profile.userId}" title=${profile.value.displayName}>
                  ${unsafeHTML(emojify(makeSafe(profile.value.displayName)))}
                </a>
              </div>
              <div class="id">
                <a class="username" href="/${profile.userId}" title=${profile.value.displayName}>
                  ${userId}
                </a>
              </div>
              <div class="description">${unsafeHTML(linkify(emojify(makeSafe(profile.value.description))))}</div>
              ${profile.isFollowingMe ? html`
                <div>
                  <span class="label">Follows you</span>
                </div>
              ` : ''}
            </div>
          `
        })}
      </div>
    `
  }

  renderProfileControls (profile) {
    if (!session.isActive()) return ''
    return html`
      <div class="ctrls">
        ${profile.userId === session?.info?.userId ? html`
          <span class="label">This is you</span>
        ` : profile.amIFollowing ? html`
          <button @click=${e => this.onClickUnfollow(e, profile)}>Unfollow</button>
        ` : html`
          <button @click=${e => this.onClickFollow(e, profile)}>Follow</button>
        `}
      </div>
    `
  }

  // events
  // =

  async onClickFollow (e, profile) {
    e.preventDefault()
    await session.api.follows.follow(profile.userId)
    profile.amIFollowing = true
    this.requestUpdate()
  }

  async onClickUnfollow (e, profile) {
    e.preventDefault()
    await session.api.follows.unfollow(profile.userId)
    profile.amIFollowing = false
    this.requestUpdate()
  }
}

customElements.define('ctzn-user-list', UserList)

function getUniqFollowers (followers) {
  return [...new Set(followers.community.concat(followers.myCommunity).concat(followers.myFollowed))]
}