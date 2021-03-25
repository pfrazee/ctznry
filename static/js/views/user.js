import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { EditProfilePopup } from '../com/popups/edit-profile.js'
import { ComposerPopup } from '../com/popups/composer.js'
import { EditRolePopup } from '../com/popups/edit-role.js'
import { ViewMediaPopup } from '../com/popups/view-media.js'
import { BanPopup } from '../com/popups/ban.js'
import { ManageBansPopup } from '../com/popups/manage-bans.js'
import * as contextMenu from '../com/context-menu.js'
import * as toast from '../com/toast.js'
import { AVATAR_URL, BLOB_URL, PERM_DESCRIPTIONS } from '../lib/const.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { pluralize, makeSafe, linkify } from '../lib/strings.js'
import * as images from '../lib/images.js'
import { emit } from '../lib/dom.js'
import { emojify } from '../lib/emojify.js'
import '../com/header.js'
import '../com/button.js'
import '../com/img-fallbacks.js'
import '../com/feed.js'
import '../com/simple-user-list.js'
import '../com/members-list.js'
import '../com/items-list.js'
import '../com/owned-items-list.js'
import '../com/dbmethod-result-feed.js'

class CtznUser extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      userProfile: {type: Object},
      currentView: {type: String},
      followers: {type: Array},
      following: {type: Array},
      memberships: {type: Array},
      members: {type: Array},
      roles: {type: Array},
      isEmpty: {type: Boolean},
      isJoiningOrLeaving: {type: Boolean},
      expandedSections: {type: Object}
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
    this.members = undefined
    this.sharedFollowers = []
    this.sharedCommunities = []
    this.followedMembers = []
    this.roles = undefined
    this.isEmpty = false
    this.isJoiningOrLeaving = false
    this.expandedSections = {}

    const pathParts = (new URL(location)).pathname.split('/')
    this.userId = pathParts[1]
    this.currentView = pathParts[2] || 'feed'
    document.title = `Loading... | CTZN`

    this.load()
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      const urlp = new URL(location)
      const pathParts = urlp.pathname.split('/')
      this.userId = pathParts[1]
      this.currentView = pathParts[2] || 'feed'
      this.expandedSections = {}
      if (urlp.hash.length > 1) {
        this.expandedSections[urlp.hash.slice(1)] = true
      }
      this.load()
    }
  }

  get isMe () {
    return session.info.userId === this.userId
  }

  get isCitizen () {
    return this.userProfile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get isCommunity () {
    return this.userProfile?.dbType === 'ctzn.network/public-community-db'
  }

  get amIFollowing () {
    return !!this.followers?.find?.(id => id === session.info.userId)
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

  getMembersWithRole (roleId) {
    return this.members?.filter(m => m.value.roles?.includes(roleId)) || []
  }

  hasPermission (permId) {
    let memberRecord = this.members?.find?.(m => m.value.user.userId === session.info.userId)
    if (!memberRecord) return false
    if (!memberRecord.value.roles?.length) return false
    if (memberRecord.value.roles.includes('admin')) {
      return true
    }
    for (let roleId of memberRecord.value.roles) {
      let roleRecord = this.roles.find(r => r.value.roleId === roleId)
      if (roleRecord && !!roleRecord.value.permissions?.find(p => p.permId === permId)) {
        return true
      }
    }
    return false
  }

  async load () {
    this.userProfile = await session.ctzn.getProfile(this.userId).catch(e => ({error: true, message: e.toString()}))
    if (this.userProfile.error) {
      document.title = `Not Found | CTZN`
      return this.requestUpdate()
    }
    document.title = `${this.userProfile?.value.displayName || this.userId} | CTZN`
    if (this.isCitizen) {
      const [followers, following, memberships] = await Promise.all([
        session.ctzn.listFollowers(this.userId),
        session.ctzn.db(this.userId).table('ctzn.network/follow').list(),
        session.ctzn.db(this.userId).table('ctzn.network/community-membership').list()
      ])
      this.followers = followers
      if (session.isActive() && !this.isMe) {
        this.sharedFollowers = intersect(session.myFollowing, followers)
      }
      this.following = following
      this.memberships = memberships
      if (session.isActive() && !this.isMe) {
        this.sharedCommunities = intersect(
          session.myCommunities.map(c => c.userId),
          memberships.map(m => m.value.community.userId)
        )
      }
      console.log({userProfile: this.userProfile, followers, following, memberships})
    } else if (this.isCommunity) {
      const [members, roles] = await Promise.all([
        listAllMembers(this.userId),
        session.ctzn.db(this.userId).table('ctzn.network/community-role').list().catch(e => [])
      ])
      this.members = members
      if (session.isActive() && !this.isMe) {
        this.followedMembers = intersect(
          session.myFollowing,
          members.map(m => m.value.user.userId)
        )
      }
      this.roles = roles
      console.log({userProfile: this.userProfile, members, roles})
    }

    if (this.querySelector('ctzn-feed')) {
      this.querySelector('ctzn-feed').load()
    }

    let expanded = Object.keys(this.expandedSections)
    if (expanded.length > 0 && this.querySelector(`#expandable-section-${expanded[0]}`)) {
      const el = this.querySelector(`#expandable-section-${expanded[0]}`)
      window.scrollTo({
        top: el.getBoundingClientRect().top - 40,
        behavior: 'smooth'
      })
    } else {
      window.scrollTo({top: 0})
    }
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('ctzn-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('ctzn-feed')
    if (feed) {
      feed.pageLoadScrollTo(y)
    } else {
      window.scrollTo(0, y)
    }
  }

  // rendering
  // =

  render () {
    const nMembers = this.members?.length || 0
    const nFollowers = this.followers?.length || 0
    const nCommunities = this.memberships?.length || 0

    if (this.userProfile?.error) {
      return this.renderError()
    }

    const navCls = (id) => `
      block text-center pt-2 pb-2.5 px-5 sm:px-7 font-semibold cursor-pointer hover:bg-gray-50 hover:text-blue-600
      ${id === this.currentView ? 'border-b-2 border-blue-600 text-blue-600' : ''}
    `.replace('\n', '')

    return html`
      <ctzn-header
        @post-created=${e => this.load()}
        .community=${this.isCommunity && this.amIAMember ? ({userId: this.userId, dbUrl: this.userProfile?.dbUrl}) : undefined}
      ></ctzn-header>
      <main>
        <div class="relative">
          <div class="absolute" style="top: 8px; left: 10px">
            <ctzn-button
              btn-class="px-3 py-1 rounded-full text-base text-white"
              href="/"
              icon="fas fa-angle-left"
              transparent
              btn-style="background: rgba(0,0,0,.3); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9); "
            ></ctzn-button>
          </div>
          <div class="absolute" style="top: 8px; right: 10px">
            ${this.renderProfileControls()}
          </div>
          <div
            class="sm:mt-1 sm:rounded-t"
            style="height: 200px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
          >
            <ctzn-img-fallbacks>
              <img
                slot="img1"
                class="sm:rounded-t"
                style="display: block; object-fit: cover; width: 100%; height: 200px;"
                src=${BLOB_URL(this.userId, 'profile-banner')}
              >
              <div slot="img2"></div>
            </ctzn-img-fallbacks>
          </div>
          <div class="absolute text-center w-full" style="top: 130px">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName}>
              <img
                class="border-4 border-white inline-block object-cover rounded-3xl shadow-md bg-white"
                src=${AVATAR_URL(this.userId)}
                style="width: 130px; height: 130px"
                @click=${this.onClickAvatar}
              >
            </a>
          </div>
          <div class="text-center pt-20 pb-4 px-4 bg-white">
            <h2 class="text-3xl font-semibold">
              <a
                class="inline-block"
                href="/${this.userId}"
                title=${this.userProfile?.value.displayName}
                style="max-width: 320px"
              >
                ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName)))}
              </a>
            </h2>
            <h2 class="text-gray-500 font-semibold">
              <a href="/${this.userId}" title="${this.userId}">
                ${this.userId}
              </a>
            </h2>
          </div>
          ${this.isCitizen ? html`
            <div class="bg-white text-center pb-4">
              <a class="bg-gray-50 font-semibold px-2 py-1 rounded sm:hover:bg-gray-100 text-gray-500" href="/${this.userId}/about" @click=${e => this.onGotoExpandedView(e, 'followers')}>
                <span class="fas fa-fw fa-user"></span>
                ${nFollowers} ${pluralize(nFollowers, 'Follower')}
              </a>
              <a class="ml-1 bg-gray-50 font-semibold px-2 py-1 rounded sm:hover:bg-gray-100 text-gray-500" href="/${this.userId}/about" @click=${e => this.onGotoExpandedView(e, 'communities')}>
                <span class="fas fa-fw fa-users"></span>
                ${nCommunities} ${nCommunities === 1 ? 'Community' : 'Communities'}
              </a>
            </div>
          ` : ''}
          ${this.isCommunity ? html`
            <div class="bg-white text-center pb-4">
              <a class="bg-gray-50 font-bold px-2 py-1 rounded sm:hover:bg-gray-100 text-gray-500" href="/${this.userId}/about" @click=${e => this.onGotoExpandedView(e, 'members')}>
                <span class="fas fa-users"></span>
                ${nMembers} ${pluralize(nMembers, 'Member')}
              </a>
            </div>
          ` : ''}
          ${this.userProfile?.value.description ? html`
            <div class="text-center pb-4 px-4 sm:px-7 bg-white">${unsafeHTML(linkify(emojify(makeSafe(this.userProfile?.value.description))))}</div>
          ` : ''}
          ${!this.isMe && this.isCitizen && this.amIFollowing === false ? html`
            <div class="bg-white text-center pb-4 px-4">
              <ctzn-button
                btn-class="font-semibold py-1 text-base block w-full rounded-lg sm:px-10 sm:inline sm:w-auto sm:rounded-full"
                @click=${this.onClickFollow}
                label="Follow ${this.userProfile?.value.displayName || this.userId}"
                primary
              ></ctzn-button>
            </div>
          ` : ''}
          ${this.isCommunity && this.amIAMember === false ? html`
            <div class="bg-white text-center pb-4 px-4">
              <ctzn-button
                btn-class="font-semibold py-1 text-base block w-full rounded-lg sm:px-10 sm:inline sm:w-auto sm:rounded-full"
                @click=${this.onClickJoin}
                label="Join community"
                ?spinner=${this.isJoiningOrLeaving}
                primary
              ></ctzn-button>
            </div>
          ` : ''}
          <div class="flex bg-white text-gray-400 sticky top-0 z-10 overflow-x-auto mb-1 sm:rounded-b">
            <a class="${navCls('feed')}" href="/${this.userId}">Feed</a>
            <a class="${navCls('inventory')}" href="/${this.userId}/inventory">${this.isCommunity ? 'Items' : 'Inventory'}</a>
            <a class="${navCls('about')}" href="/${this.userId}/about">About</a>
          </div>
          ${this.renderCurrentView()}
        </div>
        <div>
          ${this.renderRightSidebar()}
        </div>
      </main>
    `
  }

  renderError () {
    return html`
      <main class="bg-gray-100 min-h-screen">
        <ctzn-header></ctzn-header>
        <div class="text-center py-48">
          <h2 class="text-5xl text-gray-600 font-semibold mb-4">404 Not Found</h2>
          <div class="text-lg text-gray-600 mb-4">We couldn't find ${this.userId}</div>
          <div class="text-lg text-gray-600">
            <a class="text-blue-600 hover:underline" href="/" title="Back to home">
              <span class="fas fa-angle-left fa-fw"></span> Home</div>
            </a>
          </div>
        </div>
      </main>
    `
  }

  renderProfileControls () {
    const btnStyle = `background: rgba(0,0,0,.3); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9);`
    if (this.isCitizen) {
      return html`
        <div>
          ${session.isActive() ? html`
            ${session.info.userId === this.userId ? html`
              <ctzn-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickEditProfile}
                label="Edit profile"
                transparent
                btn-style=${btnStyle}
              ></ctzn-button>
            ` : html`
              ${this.amIFollowing === true ? html`
                <ctzn-button
                  btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                  @click=${this.onClickUnfollow}
                  label="Unfollow"
                  transparent
                  btn-style=${btnStyle}
                ></ctzn-button>
              ` : this.amIFollowing === false ? html`
                <ctzn-button
                  btn-class="font-medium px-6 py-1 rounded-full text-base text-white"
                  @click=${this.onClickFollow}
                  label="Follow"
                  transparent
                  btn-style=${btnStyle}
                ></ctzn-button>
              ` : ``}
            `}
          ` : html`
            ${''/*TODO logged out UI*/}
          `}
        </div>
      `
    }
    if (this.isCommunity) {
      return html`
        <div>
          ${session.isActive() ? html`
            ${this.amIAMember === true ? html`
              <ctzn-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickCreatePost}
                label="Create Post"
                transparent
                btn-style=${btnStyle}
              ></ctzn-button>
              <ctzn-button
                btn-class="font-semibold px-3 py-1 rounded-full text-base text-white"
                @click=${(e) => this.onClickControlsMenu(e)}
                icon="fas fa-fw fa-ellipsis-h"
                transparent
                btn-style=${btnStyle}
              ></ctzn-button>
            ` : this.amIAMember === false ? html`
              <ctzn-button
                btn-class="font-semibold px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickJoin}
                label="Join"
                ?spinner=${this.isJoiningOrLeaving}
                transparent
                btn-style=${btnStyle}
              ></ctzn-button>
            ` : ``}
          ` : html`
            ${''/*TODO logged out UI*/}
          `}
        </div>
      `
    }
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
    return '' // TODO
    const nSharedFollowers = 0 // TODOthis.followers?.myFollowed?.length || 0
    const nMemberships = this.memberships?.length
    return html`
      <nav>
        <section class="mb-2">
          ${nSharedFollowers ? html`
            <div class="font-medium mb-1">Followed by</div>
            ${repeat(this.followers?.myFollowed, userId => html`
              <a class="inline-block bg-gray-100 rounded p-1 mr-.5 mb-.5 text-xs hover:bg-gray-200" href="/${userId}">${displayNames.render(userId)}</a>
            `)}
          ` : ''}
        </section>
        <section class="mb-2">
          ${nMemberships ? html`
            <div class="font-medium mb-1">Member of</div>
            ${repeat(this.memberships, membership => html`
              <a class="inline-block bg-gray-100 rounded p-1 mr-.5 mb-.5 text-xs hover:bg-gray-200" href="/${membership.value.community.userId}">${displayNames.render(membership.value.community.userId)}</a>
            `)}
          ` : html`
            <div class="py-2 px-3 text-sm text-gray-600 bg-gray-100">
              Not a member of any communities
            </div>
          `}
        </section>
      </nav>
    `
  }

  renderCommunityRightSidebar () {
    return html`
      <nav>
        ${!this.amIAMember ? html`
          <div class="p-1 text-gray-500 text-sm">
            Join ${this.userProfile?.value.displayName} to participate and see the latest updates in your feed.
          </div>
        ` : ''}
      </nav>
    `
  }

  renderCurrentView () {
    if (!this.userProfile) {
      return ''
    }
    if (this.currentView === 'inventory') {
      if (this.isCitizen) {
        return this.renderCitizenInventory()
      } else if (this.isCommunity) {
        return this.renderCommunityInventory()
      }
    } else if (this.currentView === 'activity') {
      return html`
        <div class="bg-white">
          <ctzn-dbmethod-result-feed
            user-id=${this.userId}
          ></ctzn-dbmethod-result-feed>
        </div>
      `
    } else if (this.currentView === 'about') {
      if (this.isCitizen) {
        return this.renderCitizenAbout()
      } else if (this.isCommunity) {
        return this.renderCommunityAbout()
      }
    }
    return html`
      <div>
        ${this.isEmpty ? this.renderEmptyMessage() : ''}
        <ctzn-feed
          .source=${this.userId}
          limit="50"
          @load-state-updated=${this.onFeedLoadStateUpdated}
          @publish-reply=${this.onPublishReply}
          @delete-post=${this.onDeletePost}
          @moderator-remove-post=${this.onModeratorRemovePost}
        ></ctzn-feed>
      </div>
    `
  }

  renderCitizenAbout () {
    const onToggleExpandSection = id => {
      this.expandedSections = Object.assign(this.expandedSections, {[id]: !this.expandedSections[id]})
      this.requestUpdate()
    }
    const expandableSectionHeader = (id, label, count, extra = '') => html`
      <div
        id="expandable-section-${id}"
        class="px-5 py-3 sm:rounded ${count ? 'cursor-pointer sm:hover:text-blue-600' : ''}"
        @click=${count ? e => onToggleExpandSection(id) : undefined}
      >
        <div class="flex items-center justify-between">
          <span>
            <span class="text-lg font-medium mr-1">${label}</span>
            <span class="text-gray-500 font-bold">${count || '0'}</span>
          </span>
          ${count ? html`
            <span class="fas fa-angle-${this.expandedSections[id] ? 'up' : 'down'}"></span>
          ` : ''}
        </div>
        ${extra}
      </div>
    `
    return html`
      <div class="bg-white sm:rounded my-1 ${this.expandedSections.followers ? 'pb-1' : ''}">
        ${expandableSectionHeader('followers', 'Followers', this.followers?.length, this.sharedFollowers?.length ? html`
          <div class="pt-1 flex items-center text-gray-500">
            <span class="mr-2">Shared:</span>
            ${repeat(this.sharedFollowers.slice(0, 7), (userId, i) => html`
              <span data-tooltip=${userId}>
                <img src=${AVATAR_URL(userId)} class="inline-block rounded-md w-7 h-7 mr-1">
              </span>
            `)}
            ${this.sharedFollowers.length > 7 ? html`<span class="font-semibold ml-1">+${this.sharedFollowers.length - 7}` : ''}
          </div>
        ` : '')}
        ${this.expandedSections.followers ? html`
          <div class="sm:mx-2 mb-1 sm:rounded px-1 py-1 bg-gray-100">
            <ctzn-simple-user-list .ids=${this.followers} empty-message="${this.userProfile.value.displayName} has no followers."></ctzn-simple-user-list>
          </div>
        ` : ''}
      </div>
      <div class="bg-white sm:rounded my-1 ${this.expandedSections.following ? 'pb-1' : ''}">
        ${expandableSectionHeader('following', 'Following', this.following?.length)}
        ${this.expandedSections.following ? html`
          <div class="sm:mx-2 mb-1 sm:rounded px-1 py-1 bg-gray-100">
            <ctzn-simple-user-list .ids=${this.following?.map(f => f.value.subject.userId)} empty-message="${this.userProfile.value.displayName} is not following anybody."></ctzn-simple-user-list>
          </div>
        ` : ''}
      </div>
      <div class="bg-white sm:rounded my-1 ${this.expandedSections.communities ? 'pb-1' : ''}">
        ${expandableSectionHeader('communities', 'Communities', this.memberships?.length, this.sharedCommunities?.length ? html`
          <div class="pt-1 flex items-center text-gray-500">
            <span class="mr-2">Shared:</span>
            ${repeat(this.sharedCommunities.slice(0, 7), (userId, i) => html`
              <span data-tooltip=${userId}>
                <img src=${AVATAR_URL(userId)} class="inline-block rounded-md w-7 h-7 mr-1">
              </span>
            `)}
            ${this.sharedCommunities.length > 7 ? html`<span class="font-semibold ml-1">+${this.sharedCommunities.length - 7}</span>` : ''}
          </div>
        ` : '')}
        ${this.expandedSections.communities ? html`
          <div class="sm:mx-2 mb-1 sm:rounded px-1 py-1 bg-gray-100">
            ${repeat(this.memberships || [], (membership, i) => {
              const userId = membership.value.community.userId
              const [username, domain] = userId.split('@')
              return html`
                <div class="flex items-center px-2 py-2 bg-white rounded ${i !== 0 ? 'mt-1' : ''}">
                  <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
                    <img class="block rounded-md w-10 h-10 object-cover shadow-sm" src=${AVATAR_URL(userId)}>
                  </a>
                  <div class="flex-1 min-w-0 truncate">
                    <a class="hover:underline" href="/${userId}" title=${userId}>
                      <span class="font-medium">${displayNames.render(userId)}</span>
                    </a>
                    <span class="hidden sm:inline text-sm text-gray-500">${domain}</span>
                  </div>
                </div>
              `
            })}
          </div>
        ` : ''}
      </div>
    `
  }

  renderCommunityInventory () {
    return html`
      <ctzn-items-list
        user-id=${this.userId}
        .members=${this.members}
        ?canManageItemClasses=${this.hasPermission('ctzn.network/perm-manage-item-classes')}
        ?canCreateItem=${this.hasPermission('ctzn.network/perm-create-item')}
        ?canTransferUnownedItem=${this.hasPermission('ctzn.network/perm-transfer-unowned-item')}
      ></ctzn-items-list>
    `
  }

  renderCitizenInventory () {
    return html`
      <ctzn-owned-items-list
        user-id=${this.userId}
      ></ctzn-owned-items-list>
    `
  }

  renderCommunityAbout () {
    const canManageRoles = this.hasPermission('ctzn.network/perm-community-manage-roles')
    const canBan = this.hasPermission('ctzn.network/perm-community-ban')
    const onToggleExpandSection = id => {
      this.expandedSections = Object.assign(this.expandedSections, {[id]: !this.expandedSections[id]})
      this.requestUpdate()
    }
    const expandableSectionHeader = (id, label, count, extra = '') => html`
      <div
        id="expandable-section-${id}"
        class="px-5 py-3 sm:rounded ${count ? 'cursor-pointer sm:hover:text-blue-600' : ''}"
        @click=${count ? e => onToggleExpandSection(id) : undefined}
      >
        <div class="flex items-center justify-between">
          <span>
            <span class="text-lg font-medium mr-1">${label}</span>
            <span class="text-gray-500 font-bold">${count || '0'}</span>
          </span>
          ${count ? html`
            <span class="fas fa-angle-${this.expandedSections[id] ? 'up' : 'down'}"></span>
          ` : ''}
        </div>
        ${extra}
      </div>
    `
    const renderRole = (roleId, permissions) => {
      let members = this.getMembersWithRole(roleId)
      return html`
        <div class="px-4 py-2 bg-white sm:rounded mb-1">
          <div class="flex items-center">
            <span class="font-semibold text-lg flex-1"><span class="text-sm far fa-fw fa-user"></span> ${roleId}</span>
            ${roleId !== 'admin' && this.hasPermission('ctzn.network/perm-community-manage-roles') ? html`
              <ctzn-button btn-class="text-sm px-3 py-0 rounded-3xl" label="Remove" @click=${e => this.onRemoveRole(e, roleId)}></ctzn-button>
            ` : ''}
            ${this.hasPermission('ctzn.network/perm-community-manage-roles') ? html`
              <ctzn-button btn-class="text-sm px-3 py-0 ml-1 rounded-3xl" label="Edit" @click=${e => this.onEditRole(e, roleId, permissions)}></ctzn-button>
            ` : ''}
          </div>
          <div class="text-gray-500">
            ${roleId === 'admin' ? html`
              <div>&bull; Runs this community.</div>
            ` : permissions.length ? html`
              ${repeat(permissions, p => p.permId, p => html`
                <div>&bull; ${PERM_DESCRIPTIONS[p.permId] || p.permId}</div>
              `)}
            ` : html`
              <em>This role has no permissions</em>
            `}
          </div>
          ${members.length > 0 ? html`
            <div class="flex px-1 py-1 mt-2 rounded bg-gray-100">
              ${repeat(members, member => html`
                <a class="block" href="/${member.value.user.userId}" data-tooltip=${member.value.user.userId}>
                  <img class="block rounded object-cover w-10 h-10 mr-1" src=${AVATAR_URL(member.value.user.userId)}>
                </a>
              `)}
            </div>
          ` : ''}
        </div>
      `
    }
    return html`
      ${canManageRoles || canBan ? html`
        <div class="px-3 py-2 sm:rounded bg-white mb-1">
          ${canManageRoles ? html`
            <ctzn-button btn-class="text-sm px-4 py-1 ml-1 rounded-3xl" label="Create Role" @click=${this.onCreateRole}></ctzn-button>
          ` : ''}
          ${canBan ? html`
            <ctzn-button btn-class="text-sm px-4 py-1 ml-1 rounded-3xl" label="Manage Banned Users" @click=${this.onClickManageBans}></ctzn-button>
          ` : ''}
        </div>
      ` : ''}
      ${renderRole('admin')}
      ${repeat(this.roles || [], r => r.value.roleId, r => renderRole(r.value.roleId, r.value.permissions))}
      <div class="bg-white sm:rounded my-1 ${this.expandedSections.communities ? 'pb-1' : ''}">
      ${expandableSectionHeader('members', 'Members', this.members?.length, this.followedMembers?.length ? html`
        <div class="pt-1 flex items-center text-gray-500">
          <span class="mr-2">Followed:</span>
          ${repeat(this.followedMembers.slice(0, 7), (userId, i) => html`
            <span data-tooltip=${userId}>
              <img src=${AVATAR_URL(userId)} class="inline-block rounded-md w-7 h-7 mr-1">
            </span>
          `)}
          ${this.followedMembers.length > 7 ? html`<span class="font-semibold ml-1">+${this.followedMembers.length - 7}</span>` : ''}
        </div>
      ` : '')}
      ${this.expandedSections.members ? html`
        <div class="sm:mx-2 mb-1 sm:rounded px-1 py-1 bg-gray-100">
          <ctzn-members-list
            .members=${this.members}
            ?canban=${canBan}
            @ban=${this.onBan}
          ></ctzn-members-list>
        </div>
      ` : ''}
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

  async onGotoExpandedView (e, id) {
    e.preventDefault()
    emit(this, 'navigate-to', {detail: {url: `/${this.userId}/about#${id}`}})
    this.expandedSections = {[id]: true}
  }

  onClickAvatar (e) {
    e.preventDefault()
    ViewMediaPopup.create({url: AVATAR_URL(this.userId)})
  }

  async onClickEditProfile (e) {
    const uploadBlob = async (blobName, dataUrl) => {
      let {base64buf, mimeType} = images.parseDataUrl(dataUrl)
      let res, lastError
      for (let i = 1; i < 6; i++) {
        try {
          if (blobName) {
            res = await session.ctzn.blob.update(blobName, base64buf)
          } else {
            res = await session.ctzn.blob.create(base64buf)
          }
        } catch (e) {
          lastError = e
          let shrunkDataUrl = await images.shrinkImage(dataUrl, (10 - i) / 10, mimeType)
          base64buf = images.parseDataUrl(shrunkDataUrl).base64buf
        }
      }
      if (!res) {
        console.error(lastError)
        throw new Error(`Failed to upload ${blobName}: ${lastError.toString()}`)
      }
      return res
    }

    let newProfile = await EditProfilePopup.create(this.userId, this.userProfile.value)
    
    try {
      let isPending = false
      if (this.isCitizen) {
        await session.ctzn.user.table('ctzn.network/profile').create(newProfile.profile)
      } else if (this.isCommunity) {
        let res = await session.ctzn.db(this.userId).method(
          'ctzn.network/put-profile-method',
          newProfile.profile
        )
        isPending = isPending || res.pending()
      }
      this.userProfile.value = newProfile.profile
      if (newProfile.uploadedAvatar) {
        toast.create('Uploading avatar...')
        if (this.isCitizen) {
          await uploadBlob('avatar', newProfile.uploadedAvatar)
        } else if (this.isCommunity) {
          const blobRes = await uploadBlob(undefined, newProfile.uploadedAvatar)
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-avatar-method',
            {
              blobSource: {userId: session.info.userId, dbUrl: session.info.dbUrl},
              blobName: blobRes.name
            }
          )
          isPending = isPending || res.pending()
        }
      }
      if (newProfile.uploadedBanner) {
        toast.create('Uploading banner image...')
        if (this.isCitizen) {
          await uploadBlob('profile-banner', newProfile.uploadedBanner)
        } else if (this.isCommunity) {
          const blobRes = await uploadBlob(undefined, newProfile.uploadedBanner)
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-blob-method',
            {
              source: {
                userId: session.info.userId,
                dbUrl: session.info.dbUrl,
                blobName: blobRes.name
              },
              target: {
                blobName: 'profile-banner'
              }
            }
          )
          isPending = isPending || res.pending()
        }
      }
      if (!isPending) {
        toast.create('Profile updated', 'success')
      }
      this.requestUpdate()

      if (newProfile.uploadedAvatar || newProfile.uploadedBanner) {
        setTimeout(() => location.reload(), 1e3)
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
    }
  }

  async onClickFollow (e) {
    await session.ctzn.user.table('ctzn.network/follow').create({
      subject: {userId: this.userId, dbUrl: this.userProfile.dbUrl}
    })
    this.followers = await session.ctzn.listFollowers(this.userId)
  }

  async onClickUnfollow (e) {
    await session.ctzn.user.table('ctzn.network/follow').delete(this.userId)
    this.followers = await session.ctzn.listFollowers(this.userId)
  }

  async onClickJoin (e) {
    try {
      this.isJoiningOrLeaving = true
      await session.api.communities.join(this.userId)
      await session.loadSecondaryState()
      this.members = await listAllMembers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    this.isJoiningOrLeaving = false
  }

  async onClickLeave (e) {
    try {
      this.isJoiningOrLeaving = true
      await session.api.communities.leave(this.userId)
      await session.loadSecondaryState()
      this.members = await listAllMembers(this.userId)
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    this.isJoiningOrLeaving = false
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await ComposerPopup.create({
        community: {userId: this.userId, dbUrl: this.userProfile?.dbUrl}
      })
      toast.create('Post published', '', 10e3)
      this.querySelector('ctzn-feed').load()
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  async onCreateRole (e) {
    try {
      await EditRolePopup.create({communityId: this.userId})
      this.load()
    } catch (e) {
      // ignore
    }
  }

  async onEditRole (e, roleId, permissions) {
    try {
      await EditRolePopup.create({
        communityId: this.userId,
        roleId,
        permissions,
        members: this.getMembersWithRole(roleId)
      })
      this.load()
    } catch (e) {
      // ignore
    }
  }

  async onRemoveRole (e, roleId) {
    if (!confirm('Remove this role?')) {
      return
    }
    try {
      let res = await session.ctzn.db(this.userId).method(
        'ctzn.network/community-delete-role-method',
        {roleId}
      )
      if (!res.pending()) {
        toast.create(`${roleId} role removed`)
      }
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onBan (e) {
    try {
      await BanPopup.create({
        communityId: this.userId,
        member: e.detail.member
      })
      this.load()
    } catch (e) {
      // ignore
    }
  }

  async onClickManageBans (e) {
    try {
      await ManageBansPopup.create({
        communityId: this.userId,
        citizenId: e.detail.userId
      })
      this.load()
    } catch (e) {
      // ignore
    }
  }

  async onDeletePost (e) {
    try {
      await session.ctzn.user.table('ctzn.network/post').delete(e.detail.post.key)
      toast.create('Post deleted')
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onModeratorRemovePost (e) {
    try {
      const post = e.detail.post
      await session.ctzn.db(post.value.community.userId).method(
        'ctzn.network/community-remove-content-method',
        {contentUrl: post.url}
      )
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  onClickControlsMenu (e) {
    e.preventDefault()
    e.stopPropagation()

    const setView = (view) => {
      emit(this, 'navigate-to', {detail: {url: `/${this.userId}/${view}`}})
    }

    let items = []
    if (this.isCommunity) {
      if (this.hasPermission('ctzn.network/perm-community-edit-profile')) {
        items.push({
          label: 'Edit profile',
          click: () => this.onClickEditProfile()
        })
        items.push('-')
      }
      items.push({icon: 'far fa-fw fa-gem', label: 'Virtual items', click: () => setView('items')})
      items.push({icon: 'fas fa-fw fa-stream', label: 'Activity log', click: () => setView('activity')})
      items.push('-')
      items.push({label: 'Leave community', click: () => this.onClickLeave()})
    }
    let rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right,
      y: rect.bottom,
      right: true,
      roomy: true,
      noBorders: true,
      style: `padding: 4px 0; font-size: 16px; font-weight: 500; min-width: 140px`,
      items
    })
  }
}

customElements.define('ctzn-user-view', CtznUser)

async function listAllMembers (userId) {
  let members = []
  let gt = undefined
  for (let i = 0; i < 1000; i++) {
    let m = await session.ctzn.db(userId).table('ctzn.network/community-member').list({gt, limit: 100})
    members = m.length ? members.concat(m) : members
    if (m.length < 100) break
    gt = m[m.length - 1].key
  }
  return members
}

function intersect (a, b) {
  var arr = []
  for (let av of a) {
    if (b.includes(av)) {
      arr.push(av)
    }
  }
  return arr
}