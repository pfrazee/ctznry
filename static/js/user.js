import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { EditProfilePopup } from './com/popups/edit-profile.js'
import * as toast from './com/toast.js'
import * as session from './lib/session.js'
import { pluralize } from './lib/strings.js'
import css from '../css/user.css.js'
import './com/header.js'
import './com/feed.js'
import './com/user-list.js'

class CtznUser extends LitElement {
  static get properties () {
    return {
      userProfile: {type: Object},
      currentView: {type: String},
      followers: {type: Array},
      following: {type: Array},
      isEmpty: {type: Boolean}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.userProfile = undefined
    this.currentView = 'feed'
    this.followers = undefined
    this.following = undefined
    this.isEmpty = false

    this.userId = (new URL(location)).pathname.split('/')[1]

    this.load()
  }

  get amIFollowing () {
    return !!this.followers?.find?.(id => id === session.info.userId)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subject.userId === session.info.userId)
  }

  get userUrl () {
    return `${(new URL(location)).origin}/${this.userId}`
  }

  async load () {
    await session.setup()
    this.userProfile = await session.api.profiles.get(this.userId)
    const [userProfile, followers, following] = await Promise.all([
      session.api.profiles.get(this.userId),
      session.api.follows.listFollowers(this.userId).then(res => res.followerIds),
      session.api.follows.listFollows(this.userId)
    ])
    this.userProfile = userProfile
    this.followers = followers
    this.following = following
    console.log({userProfile, followers, following})
  }

  get isLoading () {
    let queryViewEls = Array.from(this.shadowRoot.querySelectorAll('ctzn-record-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  setView (str) {
    this.currentView = str
  }

  // rendering
  // =

  render () {
    const nFollowers = this.followers?.length || 0
    const nFollowing = this.following?.length || 0
    const setView = (str) => e => {
      e.preventDefault()
      this.setView(str)
    }
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <ctzn-header></ctzn-header>
        <div class="profile-banner">
          <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
            <img class="avatar" src="${this.userProfile?.url}/avatar">
          </a>
          <h2 class="display-name">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
              ${this.userProfile?.value.displayName}
            </a>
          </h2>
          <h2 class="username">
            <a href="/${this.userId}" title="${this.userId}" @click=${setView('feed')}>
              ${this.userId}
            </a>
          </h2>
          ${this.userProfile?.value.description ? html`
            <p class="bio">${this.userProfile?.value.description}</p>
          ` : ''}
          <p class="stats">
            <a class="stat" @click=${setView('followers')}><span class="stat-number">${nFollowers}</span> ${pluralize(nFollowers, 'Follower')}</a>
            &middot;
            <a class="stat" @click=${setView('following')}><span class="stat-number">${nFollowing}</span> Following</a>
          </p>
        </div>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    const displayName = this.userProfile?.value.displayName || this.userId
    return html`
      <div class="sidebar">
        <div class="sticky">
          <section class="user-controls">
            ${session.isActive() ? html`
              ${session.info.userId === this.userId ? html`
                <button class="primary" @click=${this.onClickEditProfile}>Edit profile</button>
              ` : html`
                ${this.amIFollowing === true ? html`
                  <button @click=${this.onClickUnfollow}>Unfollow ${displayName}</button>
                ` : this.amIFollowing === false ? html`
                  <button class="primary" @click=${this.onClickFollow}>Follow ${displayName}</button>
                ` : ``}
              `}
            ` : html`
              TODO logged out UI
            `}
          </section>
        </div>
      </div>
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return ''
    }
    if (this.currentView === 'followers') {
      return html`
        <div class="twocol">
          <div>
            <h3>${this.followers?.length} ${pluralize(this.followers?.length, 'follower')}</h3>
            <ctzn-user-list .ids=${this.followers}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `
    } else if (this.currentView === 'following') {
      return html`
        <div class="twocol">
          <div>
            <h3>Following ${this.following?.length} ${pluralize(this.following?.length, 'account')}</h3>
            <ctzn-user-list .ids=${this.following.map(f => f.value.subject.userId)}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `      
    }
    return html`
      <div class="twocol">
        <div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <ctzn-feed
            .source=${this.userId}
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
          ></ctzn-feed>
        </div>
        ${this.renderRightSidebar()}
      </div>
    `
  }

  renderEmptyMessage () {
    return html`
      <div class="empty">
        <div>${this.userProfile.value.displayName} hasn't posted anything yet.</div>
      </div>
    `
  }

  // events
  // =

  onFeedLoadStateUpdated (e) {
    if (typeof e.detail?.isEmpty !== 'undefined') {
      this.isEmpty = e.detail.isEmpty
    }
    this.requestUpdate()
  }

  async onClickEditProfile (e) {
    let newProfile = await EditProfilePopup.create(this.userId, `${this.userProfile.url}/avatar`, this.userProfile.value)
    try {
      await session.api.profiles.put(newProfile.profile)
      this.userProfile.value = newProfile.profile
      if (newProfile.uploadedAvatar) {
        toast.create('Uploading avatar...')
        await session.api.profiles.putAvatar(newProfile.uploadedAvatar.base64buf)
      }
      toast.create('Profile updated', 'success')
      this.requestUpdate()

      if (newProfile.uploadedAvatar) {
        setTimeout(() => location.reload(), 1e3)
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
    }
  }

  async onClickFollow (e) {
    console.log('following', this.userId)
    await session.api.follows.follow(this.userId)
    console.log('followed', this.userId)
    this.followers = await session.api.follows.listFollowers(this.userId).then(res => res.followerIds)
    console.log(this.followers)
  }

  async onClickUnfollow (e) {
    await session.api.follows.unfollow(this.userId)
    this.followers = await session.api.follows.listFollowers(this.userId).then(res => res.followerIds)
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      subjectUrl: e.detail.subject.url
    })
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-user', CtznUser)
