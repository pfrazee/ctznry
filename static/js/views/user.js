import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { ComposerPopup } from '../com/popups/composer.js'
import { EditRolePopup } from '../com/popups/edit-role.js'
import { EditCommunityConfigPopup } from '../com/popups/edit-community-config.js'
import { ViewMediaPopup } from '../com/popups/view-media.js'
import { InvitePopup } from '../com/popups/invite.js'
import { BanPopup } from '../com/popups/ban.js'
import { ManageBansPopup } from '../com/popups/manage-bans.js'
import { TransferItemPopup } from '../com/popups/transfer-item.js'
import * as contextMenu from '../com/context-menu.js'
import * as toast from '../com/toast.js'
import {
  AVATAR_URL,
  BLOB_URL,
  PERM_DESCRIPTIONS,
  DEFAULT_COMMUNITY_PROFILE_SECTIONS,
  DEFAULT_CITIZEN_PROFILE_SECTIONS
} from '../lib/const.js'
import * as session from '../lib/session.js'
import * as gestures from '../lib/gestures.js'
import * as displayNames from '../lib/display-names.js'
import { pluralize, makeSafe, linkify } from '../lib/strings.js'
import { emit } from '../lib/dom.js'
import { emojify } from '../lib/emojify.js'
import PullToRefresh from '../../vendor/pulltorefreshjs/index.js'
import '../com/header.js'
import '../com/button.js'
import '../com/img-fallbacks.js'
import '../ctzn-tags/posts-feed.js'
import '../com/simple-user-list.js'
import '../com/members-list.js'
import '../com/dbmethod-result-feed.js'
import '../com/subnav.js'
import '../com/custom-html.js'
import '../com/edit-profile.js'

class CtznUser extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      isProfileLoading: {type: Boolean},
      userProfile: {type: Object},
      currentView: {type: String},
      followers: {type: Array},
      following: {type: Array},
      memberships: {type: Array},
      members: {type: Array},
      communityConfig: {type: Object},
      roles: {type: Array},
      isUserInvited: {type: Boolean},
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
    this.reset()
    this.currentView = undefined
    this.isJoiningOrLeaving = false
    this.expandedSections = {}

    // ui helper state
    this.lastScrolledToUserId = undefined

    const pathParts = (new URL(location)).pathname.split('/')
    this.userId = pathParts[1]
    this.currentView = pathParts[2] || undefined
    document.title = `Loading... | CTZN`

    this.load()
  }

  reset () {
    this.isProfileLoading = false
    this.userProfile = undefined
    this._sections = []
    this.followers = undefined
    this.following = undefined
    this.members = undefined
    this.sharedFollowers = []
    this.sharedCommunities = []
    this.followedMembers = []
    this.communityConfig = undefined
    this.roles = undefined
    this.isUserInvited = undefined
    this.isEmpty = false
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      const urlp = new URL(location)
      const pathParts = urlp.pathname.split('/')
      this.userId = pathParts[1]
      this.currentView = pathParts[2]
      this.expandedSections = {}
      if (urlp.hash.length > 1) {
        this.expandedSections[urlp.hash.slice(1)] = true
      }
      this.load()
    }
  }

  get isMe () {
    return session.info?.userId === this.userId
  }

  get isCitizen () {
    return this.userProfile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get isCommunity () {
    return this.userProfile?.dbType === 'ctzn.network/public-community-db'
  }

  get amIFollowing () {
    return !!this.followers?.find?.(id => id === session.info?.userId)
  }

  get isFollowingMe () {
    return !!this.following?.find?.(f => f.value.subject.userId === session.info?.userId)
  }

  get amIAMember () {
    return !!this.members?.find?.(m => m.value.user.userId === session.info?.userId)
  }

  get isMembershipClosed () {
    return this.communityConfig?.joinMode === 'closed'
  }

  get userUrl () {
    return `${(new URL(location)).origin}/${this.userId}`
  }

  get sections () {
    return this._sections
  }

  set sections (v) {
    this._sections = v
    gestures.setCurrentNav([
      {back: true},
      ...v.map(s => `/${this.userId}/${s.id}`),
      ...(this.canEditSettings ? [`/${this.userId}/settings`] : [])
    ])
  }

  get currentSection () {
    return this.sections.find(section => section.id === this.currentView)
  }

  get subnavItems () {
    let items = [
      {back: true, label: html`<span class="fas fa-angle-left"></span>`, mobileOnly: true}
    ].concat(this.sections.map(section => ({
        label: section.label || section.id,
        path: `/${this.userId}/${section.id}`
    })))
    if (this.canEditSettings) {
      items.push({
        path: `/${this.userId}/settings`,
        label: html`<span class="fas fa-cog"></span>`,
        thin: true,
        rightAlign: true
      })
    }
    return items
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

  get canEditSettings () {
    return session.info.userId === this.userId || this.hasPermission('ctzn.network/perm-community-edit-profile')
  }

  async load ({force} = {force: false}) {
    // 1. If opening a profile for the first time (change of lastScrolledToUserId) go to top
    // 2. If we're scrolled beneath the header, jump to just below the header
    if (this.lastScrolledToUserId && this.lastScrolledToUserId === this.userId) {
      const el = this.querySelector(`#scroll-target`)
      if (el) {
        let top = el.getBoundingClientRect().top
        if (top < 0) {
          window.scrollTo({top: window.scrollY + top})
        }
      }
    } else {
      window.scrollTo({top: 0})
    }
    this.lastScrolledToUserId = this.userId

    // profile change?
    if (force || this.userId !== this.userProfile?.userId) {
      this.reset()
      this.isProfileLoading = true
      this.userProfile = await session.ctzn.getProfile(this.userId).catch(e => ({error: true, message: e.toString()}))
      if (this.userProfile.error) {
        document.title = `Not Found | CTZN`
        return this.requestUpdate()
      }
      document.title = `${this.userProfile?.value.displayName || this.userId} | CTZN`
      if (this.isCitizen) {
        this.sections = this.userProfile?.value?.sections?.length
          ? this.userProfile.value.sections
          : DEFAULT_CITIZEN_PROFILE_SECTIONS
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
        this.sections = this.userProfile?.value?.sections?.length
          ? this.userProfile.value.sections
          : DEFAULT_COMMUNITY_PROFILE_SECTIONS
        const [communityConfigEntry, members, roles] = await Promise.all([
          session.ctzn.db(this.userId).table('ctzn.network/community-config').get('self').catch(e => undefined),
          listAllMembers(this.userId),
          session.ctzn.db(this.userId).table('ctzn.network/community-role').list().catch(e => [])
        ])
        this.communityConfig = communityConfigEntry?.value
        this.members = members
        if (session.isActive() && !this.isMe) {
          this.followedMembers = intersect(
            session.myFollowing,
            members.map(m => m.value.user.userId)
          )
        }
        this.roles = roles
        console.log({userProfile: this.userProfile, members, roles})

        if (session.isActive() && !this.amIFollowing && this.isMembershipClosed) {
          let inviteEntry = await session.ctzn.db(this.userId)
            .table('ctzn.network/community-invite')
            .get(session.info.userId)
            .catch(e => undefined)
          this.isUserInvited = !!inviteEntry?.value
        }
      }
      this.isProfileLoading = false
    }

    if (!this.currentView) {
      emit(this, 'navigate-to', {detail: {url: `/${this.userId}/${this.sections[0].id}`, replace: true}})
    }

    let expanded = Object.keys(this.expandedSections)
    if (expanded.length > 0 && this.querySelector(`#expandable-section-${expanded[0]}`)) {
      const el = this.querySelector(`#expandable-section-${expanded[0]}`)
      window.scrollTo({
        top: el.getBoundingClientRect().top - 40,
        behavior: 'smooth'
      })
    }

    if (this.querySelector('ctzn-posts-feed')) {
      this.querySelector('ctzn-posts-feed').load()
    } else if (this.querySelector('ctzn-dbresults-feed-feed')) {
      this.querySelector('ctzn-dbresults-feed-feed').load()
    } else if (this.querySelector('ctzn-dbmethods-feed')) {
      this.querySelector('ctzn-dbmethods-feed').load()
    }
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('ctzn-feed'))
    return this.isProfileLoading || !!queryViewEls.find(el => el.isLoading)
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

  connectedCallback () {
    super.connectedCallback(
    this.ptr = PullToRefresh.init({
      mainElement: 'body',
      onRefresh: () => {
        this.load()
      }
    }))
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    PullToRefresh.destroyAll()
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

    const canJoin = !this.isMembershipClosed || (this.isMembershipClosed && this.isUserInvited)

    return html`
      <app-header
        @post-created=${e => this.load()}
        .community=${this.isCommunity && this.amIAMember ? ({userId: this.userId, dbUrl: this.userProfile?.dbUrl}) : undefined}
      ></app-header>
      ${this.renderDesktopHeader()}
      ${this.renderMobileHeader()}
      <main>
        <div>
          ${this.isCitizen ? html`
            <div class="bg-white text-center pb-4">
              <span class="bg-gray-50 font-semibold px-2 py-1 rounded text-gray-500">
                <span class="fas fa-fw fa-user"></span>
                ${nFollowers} ${pluralize(nFollowers, 'Follower')}
              </span>
              <span class="ml-1 bg-gray-50 font-semibold px-2 py-1 rounded text-gray-500">
                <span class="fas fa-fw fa-users"></span>
                ${nCommunities} ${nCommunities === 1 ? 'Community' : 'Communities'}
              </span>
            </div>
          ` : ''}
          ${this.isCommunity ? html`
            <div class="bg-white text-center pb-4">
              <span class="bg-gray-50 font-bold px-2 py-1 rounded text-gray-500">
                <span class="fas fa-users"></span>
                ${nMembers} ${pluralize(nMembers, 'Member')}
              </span>
              ${this.isMembershipClosed ? html`
                <span class="font-semibold ml-3 py-1 rounded text-gray-600">Invite only</span>
              ` : ''}
            </div>
          ` : ''}
          ${this.userProfile?.value.description ? html`
            <div class="text-center pb-4 px-4 sm:px-7 bg-white">${unsafeHTML(linkify(emojify(makeSafe(this.userProfile?.value.description))))}</div>
          ` : ''}
          ${!this.isProfileLoading && !this.isMe && this.isCitizen && this.amIFollowing === false ? html`
            <div class="bg-white text-center pb-4 px-4">
              <app-button
                btn-class="font-semibold py-1 text-base block w-full rounded-lg sm:px-10 sm:inline sm:w-auto sm:rounded-full"
                @click=${this.onClickFollow}
                label="Follow ${this.userProfile?.value.displayName || this.userId}"
                primary
              ></app-button>
            </div>
          ` : ''}
          ${!this.isProfileLoading && this.isCommunity && this.amIAMember === false && canJoin ? html`
            <div class="bg-white text-center pb-4 px-4">
              <app-button
                btn-class="font-semibold py-1 text-base block w-full rounded-lg sm:px-10 sm:inline sm:w-auto sm:rounded-full"
                @click=${this.onClickJoin}
                label="Join community"
                ?spinner=${this.isJoiningOrLeaving}
                primary
              ></app-button>
            </div>
          ` : ''}
          <div id="scroll-target"></div>
          <app-subnav
            nav-cls="mb-1"
            .items=${this.subnavItems}
            current-path=${this.currentPath}
          ></app-subnav>
          <div class="min-h-screen">
            ${this.renderCurrentView()}
          </div>
        </div>
      </main>
    `
  }

  renderError () {
    return html`
      <main class="bg-gray-100 min-h-screen">
        <app-header></app-header>
        <div class="text-center py-48">
          <h2 class="text-5xl text-gray-600 font-semibold mb-4">404 Not Found</h2>
          <div class="text-lg text-gray-600 mb-4">We couldn't find ${this.userId}</div>
          <div class="text-lg text-gray-600">
            <a class="text-blue-600 hov:hover:underline" href="/" title="Back to home">
              <span class="fas fa-angle-left fa-fw"></span> Home</div>
            </a>
          </div>
        </div>
      </main>
    `
  }

  renderDesktopHeader () {
    return html`
      <main class="hidden sm:block" style="padding: 0">
        <div class="relative">
          <div class="absolute" style="top: 8px; left: 10px">
            <app-button
              btn-class="px-3 py-1 rounded-full text-base text-white"
              href="/"
              icon="fas fa-angle-left"
              transparent
              btn-style="background: rgba(0,0,0,.5); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9); "
            ></app-button>
          </div>
          <div class="absolute" style="top: 8px; right: 10px">
            ${this.renderProfileControls()}
          </div>
          <div
            class="mt-2 rounded-2xl bg-blue-600"
            style="height: 300px"
          >
            <app-img-fallbacks id=${this.userId}>
              <img
                slot="img1"
                class="rounded-2xl"
                style="display: block; object-fit: cover; width: 100%; height: 300px;"
                src=${BLOB_URL(this.userId, 'profile-banner')}
              >
              <div slot="img2"></div>
            </app-img-fallbacks>
          </div>
          <div class="absolute" style="top: 150px; left: 20px">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName}>
              <img
                class="border-2 border-white inline-block object-cover rounded-3xl shadow-md bg-white"
                src=${AVATAR_URL(this.userId)}
                style="width: 130px; height: 130px"
                @click=${this.onClickAvatar}
              >
            </a>
          </div>
        </div>
      </main>
      <main class="hidden sm:block rounded-t-2xl mt-2 bg-white px-2 py-4 text-center">
        <h2
          class="text-5xl font-semibold"
        >
          <a
            class="inline-block"
            href="/${this.userId}"
            title=${this.userProfile?.value.displayName}
          >
            ${unsafeHTML(emojify(makeSafe(this.userProfile?.value.displayName), 'w-10', '0'))}
          </a>
        </h2>
        <h2
          class="text-gray-600 font-semibold"
        >
          <a href="/${this.userId}" title="${this.userId}">
            ${this.userId}
          </a>
        </h2>
      </main>
    `
  }

  renderMobileHeader () {
    return html`
      <main class="block sm:hidden" style="padding: 0">
        <div class="relative">
          <div class="absolute" style="top: 8px; left: 10px">
            <app-button
              btn-class="px-3 py-1 rounded-full text-base text-white"
              href="/"
              icon="fas fa-angle-left"
              transparent
              btn-style="background: rgba(0,0,0,.5); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9); "
            ></app-button>
          </div>
          <div class="absolute" style="top: 8px; right: 10px">
            ${this.renderProfileControls()}
          </div>
          <div
            class="sm:mt-1 sm:rounded-t"
            style="height: 200px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
          >
            <app-img-fallbacks>
              <img
                slot="img1"
                class="sm:rounded-t"
                style="display: block; object-fit: cover; width: 100%; height: 200px;"
                src=${BLOB_URL(this.userId, 'profile-banner')}
              >
              <div slot="img2"></div>
            </app-img-fallbacks>
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
        </div>
      </main>
    `
  }

  renderProfileControls () {
    if (this.isProfileLoading) return html``
    const btnStyle = `background: rgba(0,0,0,.5); backdrop-filter: blur(5px) contrast(0.9); -webkit-backdrop-filter: blur(5px) contrast(0.9);`
    if (this.isCitizen) {
      return html`
        <div>
          ${session.isActive() ? html`
            ${session.info.userId === this.userId ? html`
              <app-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                href="/${this.userId}/settings"
                label="Edit profile"
                transparent
                btn-style=${btnStyle}
              ></app-button>
            ` : html`
              ${this.amIFollowing === true ? html`
                <app-button
                  btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                  @click=${this.onClickUnfollow}
                  label="Unfollow"
                  transparent
                  btn-style=${btnStyle}
                ></app-button>
              ` : this.amIFollowing === false ? html`
                <app-button
                  btn-class="font-medium px-6 py-1 rounded-full text-base text-white"
                  @click=${this.onClickFollow}
                  label="Follow"
                  transparent
                  btn-style=${btnStyle}
                ></app-button>
              ` : ``}
            `}
          ` : ''}
        </div>
      `
    }
    if (this.isCommunity) {
      const canJoin = !this.isMembershipClosed || (this.isMembershipClosed && this.isUserInvited)
      return html`
        <div>
          ${session.isActive() ? html`
            ${this.amIAMember === true ? html`
              <app-button
                btn-class="font-medium px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickCreatePost}
                label="Create Post"
                transparent
                btn-style=${btnStyle}
              ></app-button>
            ` : this.amIAMember === false && canJoin ? html`
              <app-button
                btn-class="font-semibold px-5 py-1 rounded-full text-base text-white"
                @click=${this.onClickJoin}
                label="Join"
                ?spinner=${this.isJoiningOrLeaving}
                transparent
                btn-style=${btnStyle}
              ></app-button>
            ` : ``}
            <app-button
              btn-class="font-semibold px-3 py-1 rounded-full text-base text-white"
              @click=${(e) => this.onClickControlsMenu(e)}
              icon="fas fa-fw fa-ellipsis-h"
              transparent
              btn-style=${btnStyle}
            ></app-button>
          ` : ''}
        </div>
      `
    }
  }

  renderCurrentView () {
    if (this.currentView === 'settings') {
      if (this.canEditSettings) {
        return html`
          <app-edit-profile
            user-id=${this.userId}
            .profile=${this.userProfile}
            @profile-updated=${this.onProfileUpdated}
          ></app-edit-profile>
        `
      }
      return html`
        <div class="bg-white px-8 py-5 text-gray-600 sm:rounded mb-0.5">
          You don't have access to this user's settings.
        </div>
      `
    } else if (this.currentSection) {
      return html`
        <app-custom-html
          context="profile"
          .contextState=${{page: {userId: this.userId}}}
          .userId=${this.userId}
          .blobName="ui:profile:${this.currentSection.id}"
          .html=${this.currentSection.html}
        ></app-custom-html>
      `
    }
    // } else if (this.currentView === 'inventory') {
    //   if (this.isCitizen) {
    //     return this.renderCitizenInventory()
    //   } else if (this.isCommunity) {
    //     return this.renderCommunityInventory()
    //   }
    // } else if (this.currentView === 'activity') {
    //   return html`
    //     ${this.isEmpty ? this.renderEmptyMessage() : ''}
    //     <app-activity-feed
    //       user-id=${this.userId}
    //       dataview=${this.isCommunity ? 'ctzn.network/dbmethod-results-view' : 'ctzn.network/dbmethod-calls-view'}
    //       @load-state-updated=${this.onFeedLoadStateUpdated}
    //     ></app-activity-feed>
    //   `
    // } else if (this.currentView === 'audit-log') {
    //   return html`
    //     <div class="bg-white">
    //       <app-dbmethod-result-feed
    //         user-id=${this.userId}
    //       ></app-dbmethod-result-feed>
    //     </div>
    //   `
    // } else if (this.currentView === 'about') {
    //   if (this.isCitizen) {
    //     return this.renderCitizenAbout()
    //   } else if (this.isCommunity) {
    //     return this.renderCommunityAbout()
    //   }
    // }
    // return html`
    //   ${this.isEmpty ? this.renderEmptyMessage() : ''}
    //   <app-feed
    //     .source=${this.userId}
    //     limit="15"
    //     @load-state-updated=${this.onFeedLoadStateUpdated}
    //     @publish-reply=${this.onPublishReply}
    //     @delete-post=${this.onDeletePost}
    //     @moderator-remove-post=${this.onModeratorRemovePost}
    //   ></app-feed>
    // `
  }

  /*renderCitizenAbout () {
    const onToggleExpandSection = id => {
      this.expandedSections = Object.assign(this.expandedSections, {[id]: !this.expandedSections[id]})
      this.requestUpdate()
    }
    const expandableSectionHeader = (id, label, count, extra = '') => html`
      <div
        id="expandable-section-${id}"
        class="px-5 py-3 sm:rounded ${count ? 'cursor-pointer hov:hover:text-blue-600' : ''}"
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
            <app-simple-user-list .ids=${this.followers} empty-message="${this.userProfile.value.displayName} has no followers."></app-simple-user-list>
          </div>
        ` : ''}
      </div>
      <div class="bg-white sm:rounded my-1 ${this.expandedSections.following ? 'pb-1' : ''}">
        ${expandableSectionHeader('following', 'Following', this.following?.length)}
        ${this.expandedSections.following ? html`
          <div class="sm:mx-2 mb-1 sm:rounded px-1 py-1 bg-gray-100">
            <app-simple-user-list .ids=${this.following?.map(f => f.value.subject.userId)} empty-message="${this.userProfile.value.displayName} is not following anybody."></app-simple-user-list>
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
                    <a class="hov:hover:underline" href="/${userId}" title=${userId}>
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
      <app-items-list
        user-id=${this.userId}
        .members=${this.members}
        ?canManageItemClasses=${this.hasPermission('ctzn.network/perm-manage-item-classes')}
        ?canCreateItem=${this.hasPermission('ctzn.network/perm-create-item')}
        ?canTransferUnownedItem=${this.hasPermission('ctzn.network/perm-transfer-unowned-item')}
      ></app-items-list>
    `
  }

  renderCitizenInventory () {
    return html`
      ${!this.isMe ? html`
        <div class="mx-2 sm:mx-0 mt-3 mb-2 rounded-full border border-gray-300 px-2 py-2">
          <app-button
            btn-class="rounded-full py-1"
            icon="fas fa-fw fa-exchange-alt"
            label="Give Item"
            @click=${this.onClickGiveItem}
          ></app-button>
        </div>
      ` : html`<div class="mb-3"></div>`}
      <app-owned-items-list
        user-id=${this.userId}
      ></app-owned-items-list>
    `
  }

  renderCommunityAbout () {
    const canInvite = this.hasPermission('ctzn.network/perm-community-invite')
    const canManageRoles = this.hasPermission('ctzn.network/perm-community-manage-roles')
    const canBan = this.hasPermission('ctzn.network/perm-community-ban')
    const canEditConfig = this.hasPermission('ctzn.network/perm-community-update-config')
    const onToggleExpandSection = id => {
      this.expandedSections = Object.assign(this.expandedSections, {[id]: !this.expandedSections[id]})
      this.requestUpdate()
    }
    const expandableSectionHeader = (id, label, count, extra = '') => html`
      <div
        id="expandable-section-${id}"
        class="px-5 py-3 sm:rounded ${count ? 'cursor-pointer hov:hover:text-blue-600' : ''}"
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
              <button class="text-sm ml-1 px-2 py-0 border border-gray-200 rounded cursor-pointer hov:hover:bg-gray-50" @click=${e => this.onRemoveRole(e, roleId)}>Remove</button>
            ` : ''}
            ${this.hasPermission('ctzn.network/perm-community-manage-roles') ? html`
              <button class="text-sm ml-1 px-2 py-0 border border-gray-200 rounded cursor-pointer hov:hover:bg-gray-50" @click=${e => this.onEditRole(e, roleId, permissions)}>Edit</button>
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
      ${canInvite || canManageRoles || canBan || canEditConfig ? html`
        <div class="px-3 py-2 sm:rounded bg-white mb-1">
          ${canInvite ? html`
            <button
              class="block w-full text-center mb-1 px-3 py-2 border border-gray-200 rounded cursor-pointer sm:text-sm sm:inline-block sm:w-auto hov:hover:bg-gray-50 sm:py-1 sm:mb-0"
              @click=${this.onCreateInvite}
            >Invite New Member</button>
          ` : ''}
          ${canManageRoles ? html`
            <button
              class="block w-full text-center mb-1 px-3 py-2 border border-gray-200 rounded cursor-pointer sm:text-sm sm:inline-block sm:w-auto hov:hover:bg-gray-50 sm:py-1 sm:mb-0"
              @click=${this.onCreateRole}
            >Create Role</button>
          ` : ''}
          ${canBan ? html`
            <button
              class="block w-full text-center mb-1 px-3 py-2 border border-gray-200 rounded cursor-pointer sm:text-sm sm:inline-block sm:w-auto hov:hover:bg-gray-50 sm:py-1 sm:mb-0"
              @click=${this.onClickManageBans}
            >Manage Banned Users</button>
          ` : ''}
          ${canEditConfig ? html`
            <button
              class="block w-full text-center mb-1 px-3 py-2 border border-gray-200 rounded cursor-pointer sm:text-sm sm:inline-block sm:w-auto hov:hover:bg-gray-50 sm:py-1 sm:mb-0"
              @click=${this.onClickEditSettings}
            >Edit Settings</button>
          ` : ''}
        </div>
      ` : ''}
      ${renderRole('admin')}
      ${repeat(this.roles || [], r => r.value.roleId, r => renderRole(r.value.roleId, r.value.permissions))}
      <div class="bg-white sm:rounded my-1 ${this.expandedSections.communities ? 'pb-1' : ''}">
      ${expandableSectionHeader('members', 'Members', this.members?.length, this.followedMembers?.length ? html`
        <div class="py-1 flex items-center text-gray-500">
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
          <app-members-list
            .members=${this.members}
            ?canban=${canBan}
            @ban=${this.onBan}
          ></app-members-list>
        </div>
      ` : ''}
    `
  }

  renderEmptyMessage () {
    if (this.currentView === 'activity') {
      return html`
        <div class="bg-gray-50 text-gray-500 py-12 text-center">
          ${this.isCitizen ? html`
            <div>${this.userProfile?.value?.displayName} hasn't created any actions yet.</div>
          ` : this.isCommunity ? html`
            <div>No items activity has occurred in ${this.userProfile?.value?.displayName} yet.</div>
          ` : ''}
        </div>
      `
    }
    return html`
      <div class="bg-gray-50 text-gray-500 py-12 text-center">
        ${this.isCitizen ? html`
          <div>${this.userProfile?.value?.displayName} hasn't posted anything yet.</div>
        ` : this.isCommunity ? html`
          <div>Nobody has posted to ${this.userProfile?.value?.displayName} yet.</div>
        ` : ''}
      </div>
    `
  }*/

  // events
  // =

  onProfileUpdated (e) {
    this.load({force: true})
  }

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

  async onCreateInvite (e) {
    try {
      await InvitePopup.create({
        communityId: this.userId
      })
      toast.create('Invite created', 'success')
      this.load()
    } catch (e) {
      if (e) {
        console.log(e)
        toast.create(e.toString(), 'error')
      }
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

  async onClickEditSettings (e) {
    try {
      await EditCommunityConfigPopup.create({
        communityId: this.userId
      })
      toast.create('Settings updated', 'success')
      this.load()
    } catch (e) {
      if (e) {
        console.log(e)
        toast.create(e.toString(), 'error')
      }
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

  async onClickGiveItem (e) {
    TransferItemPopup.create({
      recpUserId: this.userId
    })
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
          click: () => setView('settings')
        })
        items.push('-')
      }
      items.push({label: 'Audit log', click: () => setView('audit-log')})
      if (this.amIAMember) {
        items.push('-')
        items.push({label: 'Leave community', click: () => this.onClickLeave()})
      }
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

customElements.define('app-user-view', CtznUser)

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