import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import css from '../../css/com/user-list.css.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { getProfile, listFollowers, listFollows } from '../lib/getters.js'
import { pluralize } from '../lib/strings.js'

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
      this.profiles.push(profile)
      this.requestUpdate()

      const [followers, following] = await Promise.all([
        listFollowers(id).then(res => res.followerIds),
        listFollows(id)
      ])
      profile.numFollowers = followers.length
      profile.numFollowing = following.length
      profile.isFollowingMe = session.isActive() && !!following.find(f => f.value.subject.userId === session.info.userId)
      profile.amIFollowing = session.isActive() && !!followers.find(f => f === session.info.userId)
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
      <div class="profiles">
        ${repeat(this.profiles, profile => {
          const nFollowers = profile.numFollowers
          const nFollowing = profile.numFollowing
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
                  ${profile.value.displayName}
                </a>
                <a class="username" href="/${profile.userId}" title=${profile.value.displayName}>
                  ${userId}
                </a>
              </div>
              <div class="description">${profile.value.description}</div>
              <div class="stats">
                <span class="stat"><span class="stat-number">${nFollowers}</span> Known ${pluralize(nFollowers, 'Follower')}</span>
                &middot;
                <span class="stat"><span class="stat-number">${nFollowing}</span> Following</span>
                ${profile.isFollowingMe ? html`
                  <span class="label">Follows you</span>
                ` : ''}
              </div>
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