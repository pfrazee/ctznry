import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { repeat } from '../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { EditProfilePopup } from './com/popups/edit-profile.js'
import * as toast from './com/toast.js'
import { AVATAR_URL } from './lib/const.js'
import * as session from './lib/session.js'
import { getProfile, listFollowers, listFollows, listMembers, listMemberships } from './lib/getters.js'
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
      memberships: {type: Array},
      members: {type: Array},
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
    this.uniqFollowers = undefined
    this.following = undefined
    this.members = undefined
    this.isEmpty = false

    this.userId = (new URL(location)).pathname.split('/')[1]

    this.load()
  }

  get isCitizen () {
    return this.userProfile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get isCommunity () {
    return this.userProfile?.dbType === 'ctzn.network/public-community-db'
  }

  get amIFollowing () {
    return !!this.uniqFollowers?.find?.(id => id === session.info.userId)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subject.userId === session.info.userId)
  }

  get amIAMember () {
    return !!this.members?.find?.(m => m.value.user.userId === session.info.userId)
  }

  get userUrl () {
    return `${(new URL(location)).origin}/${this.userId}`
  }

  async load () {
    await session.setup()
    this.userProfile = await getProfile(this.userId)
    if (this.isCitizen) {
      const [followers, following, memberships] = await Promise.all([
        listFollowers(this.userId),
        listFollows(this.userId),
        listMemberships(this.userId)
      ])
      this.followers = followers
      this.uniqFollowers = Array.from(getUniqFollowers(followers))
      this.following = following
      this.memberships = memberships
      console.log({userProfile: this.userProfile, followers, following, memberships})
    } else if (this.isCommunity) {
      this.members = await listMembers(this.userId)
      console.log({userProfile: this.userProfile, members: this.members})
    }
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
    const nFollowing = this.following?.length || 0
    const nFollowers = this.uniqFollowers?.length || 0
    const nMembers = this.members?.length || 0
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
          <h2 class="text-4xl font-semibold">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName} @click=${setView('feed')}>
              ${this.userProfile?.value.displayName}
            </a>
          </h2>
          <h2 class="text-gray-500 font-semibold">
            <a href="/${this.userId}" title="${this.userId}" @click=${setView('feed')}>
              ${this.isCitizen ? html`<span class="fas fa-fw fa-user"></span>` : ''}
              ${this.isCommunity ? html`<span class="fas fa-fw fa-users"></span>` : ''}
              ${this.userId}
            </a>
          </h2>
          ${this.userProfile?.value.description ? html`
            <div class="my-4">${this.userProfile?.value.description}</div>
          ` : ''}
          ${this.isCitizen ? html`
            <div>
              <a class="text-xs medium text-gray-500 cursor-pointer" @click=${setView('followers')}><span class="text-lg">${nFollowers}</span> ${pluralize(nFollowers, 'Follower')}</a>
              &middot;
              <a class="text-xs medium text-gray-500 cursor-pointer" @click=${setView('following')}><span class="text-lg">${nFollowing}</span> Following</a>
            </div>
          ` : this.isCommunity ? html`
            <div>
              <a class="text-sm medium text-gray-500 cursor-pointer" @click=${setView('members')}><span class="text-lg">${nMembers}</span> ${pluralize(nMembers, 'Member')}</a>
            </div>
          ` : ''}
        </div>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    if (this.isCitizen) {
      return this.renderCitizenRightSidebar()
    }
    if (this.isCommunity) {
      return this.renderCommunityRightSidebar()
    }
  }

  renderCitizenRightSidebar () {
    const nSharedFollowers = this.followers?.myFollowed?.length || 0
    const nMemberships = this.memberships?.length
    const displayName = this.userProfile?.value.displayName || this.userId
    return html`
      <div>
        <section class="mb-2">
          ${session.isActive() ? html`
            ${session.info.userId === this.userId ? html`
              <ctzn-button primary class="w-full" @click=${this.onClickEditProfile} label="Edit profile"></ctzn-button>
            ` : html`
              ${this.amIFollowing === true ? html`
                <ctzn-button class="w-full" @click=${this.onClickUnfollow} label="Unfollow ${displayName}"></ctzn-button>
              ` : this.amIFollowing === false ? html`
                <ctzn-button primary class="w-full" @click=${this.onClickFollow} label="Follow ${displayName}"></ctzn-button>
              ` : ``}
            `}
          ` : html`
            TODO logged out UI
          `}
        </section>
        <section class="mb-2">
          ${nSharedFollowers ? html`
            Followed by ${repeat(this.followers?.myFollowed, userId => html`
              <a class="inline-block bg-gray-100 rounded p-1 mr-1 mb-1 text-xs hover:bg-gray-200" href="/${userId}">${userId}</a>
            `)}
          ` : ''}
        </section>
        <section class="mb-2">
          ${nMemberships ? html`
            Communities: ${repeat(this.memberships, membership => html`
              <a class="inline-block bg-gray-100 rounded p-1 mr-1 mb-1 text-xs hover:bg-gray-200" href="/${membership.value.community.userId}">${membership.value.community.userId}</a>
            `)}
          ` : html`
            <div class="py-2 px-3 text-sm text-gray-600 bg-gray-100">
              Not a member of any communities
            </div>
          `}
        </section>
      </div>
    `
  }

  renderCommunityRightSidebar () {
    const displayName = this.userProfile?.value.displayName || this.userId
    return html`
      <div>
        <section class="mb-2">
          ${session.isActive() ? html`
            ${this.amIAMember === true ? html`
              <ctzn-button class="w-full" @click=${this.onClickLeave} label="Leave ${displayName}"></ctzn-button>
            ` : this.amIAMember === false ? html`
              <ctzn-button primary class="w-full" @click=${this.onClickJoin} label="Join ${displayName}"></ctzn-button>
            ` : ``}
          ` : html`
            TODO logged out UI
          `}
        </section>
      </div>
    `
  }

  renderCurrentView () {
    if (this.currentView === 'followers') {
      return html`
        <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
          <div>
            <h3 class="text-lg mb-4 font-semibold">${this.uniqFollowers?.length} ${pluralize(this.uniqFollowers?.length, 'Follower')}</h3>
            <ctzn-user-list .ids=${this.uniqFollowers}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `
    } else if (this.currentView === 'following') {
      return html`
        <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
          <div>
            <h3 class="text-lg mb-4 font-semibold">Following ${this.following?.length} ${pluralize(this.following?.length, 'Citizen')}</h3>
            <ctzn-user-list .ids=${this.following.map(f => f.value.subject.userId)}></ctzn-user-list>
          </div>
          ${this.renderRightSidebar()}
        </div>
      `      
    } else if (this.currentView === 'members') {
      return html`
        <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
          <div>
            <h3 class="text-lg mb-4 font-semibold">${this.members?.length} ${pluralize(this.members?.length, 'Member')}</h3>
            <ctzn-user-list .ids=${this.members.map(f => f.value.user.userId)}></ctzn-user-list>
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
      <div class="bg-gray-100 text-gray-500 py-44 text-center">
        ${this.isCitizen ? html`
          <div>${this.userProfile?.value?.displayName} hasn't posted anything yet.</div>
        ` : this.isCommunity ? html`
          <div>Nobody has posted to ${this.userProfile?.value?.displayName} yet.</div>
        ` : ''}
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
    this.uniqFollowers = Array.from(getUniqFollowers(followers))
  }

  async onClickUnfollow (e) {
    await session.api.follows.unfollow(this.userId)
    this.followers = await listFollowers(this.userId).then(res => res.followerIds)
    this.uniqFollowers = Array.from(getUniqFollowers(followers))
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

function getUniqFollowers (followers) {
  return new Set(followers.community.concat(followers.myCommunity).concat(followers.myFollowed))
}