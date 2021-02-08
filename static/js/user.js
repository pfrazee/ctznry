import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { EditProfilePopup } from './com/popups/edit-profile.js'
import * as toast from './com/toast.js'
import { AVATAR_URL } from './lib/const.js'
import * as session from './lib/session.js'
import { getProfile, listFollowers, listFollows } from './lib/getters.js'
import { pluralize } from './lib/strings.js'
import './com/header.js'
import './com/button.js'
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

  createRenderRoot() {
    return this // dont use shadow dom
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
    this.userProfile = await getProfile(this.userId)
    const [followers, following] = await Promise.all([
      listFollowers(this.userId).then(res => res.followerIds),
      listFollows(this.userId)
    ])
    this.followers = followers
    this.following = following
    console.log({userProfile: this.userProfile, followers, following})
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
        <div class="text-center pb-4 border-b border-solid border-gray-200 mb-8">
          <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
            <img class="block mx-auto mb-8 w-40 rounded-full shadow-md" src=${AVATAR_URL(this.userProfile?.userId)}>
          </a>
          <h2 class="text-4xl semibold">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
              ${this.userProfile?.value.displayName}
            </a>
          </h2>
          <h2 class="text-gray-500 bold">
            <a href="/${this.userId}" title="${this.userId}" @click=${setView('feed')}>
              ${this.userId}
            </a>
          </h2>
          ${this.userProfile?.value.description ? html`
            <div class="my-4">${this.userProfile?.value.description}</div>
          ` : ''}
          <div>
            <a class="text-xs medium text-gray-500 cursor-pointer" @click=${setView('followers')}><span class="text-lg">${nFollowers}</span> Known ${pluralize(nFollowers, 'Follower')}</a>
            &middot;
            <a class="text-xs medium text-gray-500 cursor-pointer" @click=${setView('following')}><span class="text-lg">${nFollowing}</span> Following</a>
          </div>
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
                <ctzn-button primary @click=${this.onClickEditProfile} label="Edit profile"></ctzn-button>
              ` : html`
                ${this.amIFollowing === true ? html`
                  <ctzn-button @click=${this.onClickUnfollow} label="Unfollow ${displayName}"></ctzn-button>
                ` : this.amIFollowing === false ? html`
                  <ctzn-button primary @click=${this.onClickFollow} label="Follow ${displayName}"></ctzn-button>
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
    if (this.currentView === 'followers') {
      return html`
        <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
          <div>
            <h3>${this.followers?.length} ${pluralize(this.followers?.length, 'follower')}</h3>
            <ctzn-user-list .ids=${this.followers}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `
    } else if (this.currentView === 'following') {
      return html`
        <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
          <div>
            <h3>Following ${this.following?.length} ${pluralize(this.following?.length, 'account')}</h3>
            <ctzn-user-list .ids=${this.following.map(f => f.value.subject.userId)}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `      
    }
    return html`
      <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
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
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
        <div>${this.userProfile?.value?.displayName} hasn't posted anything yet.</div>
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
    let newProfile = await EditProfilePopup.create(this.userId, AVATAR_URL(this.userId), this.userProfile.value)
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
    await session.api.follows.follow(this.userId)
    this.followers = await listFollowers(this.userId).then(res => res.followerIds)
    console.log(this.followers)
  }

  async onClickUnfollow (e) {
    await session.api.follows.unfollow(this.userId)
    this.followers = await listFollowers(this.userId).then(res => res.followerIds)
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      subject: e.detail.subject
    })
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-user', CtznUser)
