import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { EditProfilePopup } from '../com/popups/edit-profile.js'
import { ComposerPopup } from '../com/popups/composer.js'
import { EditRolePopup } from '../com/popups/edit-role.js'
import { BanPopup } from '../com/popups/ban.js'
import { ManageBansPopup } from '../com/popups/manage-bans.js'
import * as contextMenu from '../com/context-menu.js'
import * as toast from '../com/toast.js'
import { AVATAR_URL, PERM_DESCRIPTIONS } from '../lib/const.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { pluralize, makeSafe, linkify } from '../lib/strings.js'
import { emit } from '../lib/dom.js'
import { emojify } from '../lib/emojify.js'
import '../com/header.js'
import '../com/button.js'
import '../com/feed.js'
import '../com/mobile-compose-btn.js'
import '../com/simple-user-list.js'
import '../com/members-list.js'
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
      isJoiningOrLeaving: {type: Boolean}
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
    this.roles = undefined
    this.isEmpty = false
    this.isJoiningOrLeaving = false

    const pathParts = (new URL(location)).pathname.split('/')
    this.userId = pathParts[1]
    this.currentView = pathParts[2] || 'feed'
    document.title = `Loading... | CTZN`

    this.load()
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      const pathParts = (new URL(location)).pathname.split('/')
      this.userId = pathParts[1]
      this.currentView = pathParts[2] || 'feed'
      this.load()
    }
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
      this.uniqFollowers = Array.from(getUniqFollowers(followers))
      this.following = following
      this.memberships = memberships
      console.log({userProfile: this.userProfile, followers, following, memberships})
    } else if (this.isCommunity) {
      const [members, roles] = await Promise.all([
        listAllMembers(this.userId),
        session.ctzn.db(this.userId).table('ctzn.network/community-role').list().catch(e => [])
      ])
      this.members = members
      this.roles = roles
      console.log({userProfile: this.userProfile, members, roles})
    }

    if (this.querySelector('ctzn-feed')) {
      this.querySelector('ctzn-feed').load()
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

    if (this.userProfile?.error) {
      return this.renderError()
    }

    const navCls = (id, desktopOnly = false, mobileOnly = false) => `
      text-center pt-2 pb-2.5 px-7 font-semibold cursor-pointer hover:bg-gray-50 hover:text-blue-600
      ${desktopOnly ? 'hidden sm:block' : ''}
      ${mobileOnly ? 'block sm:hidden' : ''}
      ${id === this.currentView ? 'border-b-2 border-blue-600 text-blue-600' : ''}
    `.replace('\n', '')

    return html`
      <ctzn-header
        @post-created=${e => this.load()}
        .community=${this.isCommunity && this.amIAMember ? ({userId: this.userId, dbUrl: this.userProfile?.dbUrl}) : undefined}
      ></ctzn-header>
      <main>
        <div class="relative">
          <div class="absolute" style="top: 8px; right: 10px">
            ${this.renderProfileControls()}
          </div>
          <div class="bg-white pt-4 pl-2 sm:hidden">
            <a href="/${this.userId}" title=${this.userProfile?.value.displayName}>
              <img class="block h-14 ml-2 mr-6 mx-auto object-cover rounded-full shadow-md w-14" src=${AVATAR_URL(this.userId)}>
            </a>
          </div>
          <div class="flex items-center py-4 px-4 border border-gray-200 border-t-0 border-b-0 bg-white">
            <a class="hidden sm:block" href="/${this.userId}" title=${this.userProfile?.value.displayName}>
              <img class="block mx-auto ml-2 mr-6 w-16 h-16 object-cover rounded-full shadow-md" src=${AVATAR_URL(this.userId)}>
            </a>
            <div class="flex-1">
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
                  ${this.isCitizen ? html`<span class="fas fa-fw fa-user"></span>` : ''}
                  ${this.isCommunity ? html`<span class="fas fa-fw fa-users"></span>` : ''}
                  ${this.userId}
                </a>
              </h2>
            </div>
          </div>
          ${this.userProfile?.value.description ? html`
            <div class="pb-3 px-4 sm:px-7 border border-gray-200 border-t-0 border-b-0 bg-white">${unsafeHTML(linkify(emojify(makeSafe(this.userProfile?.value.description))))}</div>
          ` : ''}
          <div class="flex border border-gray-200 border-t-0 bg-white text-gray-400 sticky top-0 z-10">
            <a class="${navCls('feed')}" href="/${this.userId}">Feed</a>
            ${this.isCitizen ? html`
              <a class="${navCls('followers')}" href="/${this.userId}/followers">Followers</a>
              <a class="${navCls('following', true)}" href="/${this.userId}/following">Following</a>
              <a class="${navCls('communities', true)}" href="/${this.userId}/communities">Communities</a>
              <a class="${navCls('menu', false, true)}" @click=${this.onClickNavMore}>More <span class="fas fa-caret-down fa-fw"></span></a>
            ` : this.isCommunity ? html`
              <a class="${navCls('members')}" href="/${this.userId}/members">${nMembers} ${pluralize(nMembers, 'Member')}</a>
              <a class="${navCls('about')}" href="/${this.userId}/about">About</a>
            ` : ''}
          </div>
          ${this.renderCurrentView()}
          <ctzn-mobile-compose-btn
            .community=${this.isCommunity && this.amIAMember ? ({userId: this.userId, dbUrl: this.userProfile?.dbUrl}) : undefined}
            @post-created=${e => this.querySelector('ctzn-feed').load()}
          ></ctzn-mobile-compose-btn>
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
              <span class="fas fa-arrow-left fa-fw"></span> Home</div>
            </a>
          </div>
        </div>
      </main>
    `
  }

  renderProfileControls () {
    if (this.isCitizen) {
      return html`
        <div>
          ${session.isActive() ? html`
            ${session.info.userId === this.userId ? html`
              <ctzn-button btn-class="font-semibold px-5 py-1 rounded-full text-base" @click=${this.onClickEditProfile} label="Edit profile"></ctzn-button>
            ` : html`
              ${this.amIFollowing === true ? html`
                <ctzn-button btn-class="font-semibold px-5 py-1 rounded-full text-base" @click=${this.onClickUnfollow} label="Unfollow"></ctzn-button>
              ` : this.amIFollowing === false ? html`
                <ctzn-button btn-class="font-semibold px-6 py-1 rounded-full text-base" primary @click=${this.onClickFollow} label="Follow"></ctzn-button>
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
                primary
                btn-class="font-medium px-5 py-1 rounded-full text-base"
                @click=${this.onClickCreatePost}
                label="Create Post"
              ></ctzn-button>
              <ctzn-button
                btn-class="font-semibold px-4 py-1 rounded-full text-base"
                @click=${(e) => this.onClickControlsMenu(e)}
                icon="fas fa-fw fa-ellipsis-h"
              ></ctzn-button>
            ` : this.amIAMember === false ? html`
              <ctzn-button btn-class="font-semibold px-5 py-1 rounded-full text-base" primary @click=${this.onClickJoin} label="Join" ?spinner=${this.isJoiningOrLeaving}></ctzn-button>
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
    const nSharedFollowers = this.followers?.myFollowed?.length || 0
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
    if (this.currentView === 'followers') {
      return html`
        <div class="border border-gray-200 border-t-0 border-b-0 bg-white">
          <ctzn-simple-user-list .ids=${this.uniqFollowers} empty-message="${this.userProfile.value.displayName} has no followers."></ctzn-simple-user-list>
        </div>
      `
    } else if (this.currentView === 'following') {
      return html`
        <div class="border border-gray-200 border-t-0 border-b-0 bg-white">
          <ctzn-simple-user-list .ids=${this.following?.map(f => f.value.subject.userId)} empty-message="${this.userProfile.value.displayName} is not following anybody."></ctzn-simple-user-list>
        </div>
      `
    } else if (this.currentView === 'communities') {
      return html`
        <div class="border border-t-0 border-gray-200 px-4 py-2 bg-white">
          <div class="text-lg font-semibold">Communities</div>
        </div>
        ${this.memberships?.length === 0 ? html`
          <div class="border border-b-0 border-gray-200 border-t-0 p-4">
            ${this.userProfile?.value.displayName || this.userId} is not a member of any communities.
          </div>
        ` : html`
          <div class="border border-gray-200 border-t-0 border-b-0 bg-white">
            ${repeat(this.memberships || [], membership => {
              const userId = membership.value.community.userId
              const [username, domain] = userId.split('@')
              return html`
                <div class="flex items-center border-b border-gray-200 px-2 py-2">
                  <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
                    <img class="block rounded-full w-10 h-10 object-cover shadow-sm" src=${AVATAR_URL(userId)}>
                  </a>
                  <div class="flex-1 min-w-0 truncate">
                    <a class="hover:underline" href="/${userId}" title=${userId}>
                      <span class="font-bold">${username}</span><span class="text-gray-500">@${domain}</span>
                    </a>
                  </div>
                </div>
              `
            })}
          </div>
        `}
        </div>
      `
    } else if (this.currentView === 'members') {
      return html`
        <div class="border border-gray-200 border-t-0 border-b-0 bg-white">
          <ctzn-members-list
            .members=${this.members}
            ?canban=${this.hasPermission('ctzn.network/perm-community-ban')}
            @ban=${this.onBan}
          ></ctzn-members-list>
        </div>
      `
    } else if (this.currentView === 'activity') {
      return html`
        <div class="border border-gray-200 border-t-0 border-b-0 bg-white">
          <ctzn-dbmethod-result-feed
            user-id=${this.userId}
          ></ctzn-dbmethod-result-feed>
        </div>
      `
    } else if (this.currentView === 'about') {
      const renderRole = (roleId, permissions) => {
        let members = this.getMembersWithRole(roleId)
        return html`
          <div class="px-4 py-2 border-b border-gray-300">
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
                <div>&bull; Runs this community. Full permissions.</div>
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
                    <img class="block rounded object-cover w-10 h-10" src=${AVATAR_URL(member.value.user.userId)}>
                  </a>
                `)}
              </div>
            ` : ''}
          </div>
        `
      }
      return html`
        <div class="flex items-center border border-t-0 border-gray-200 px-4 py-2  bg-white">
          <div class="flex-1 text-lg font-semibold">Member Roles</div>
          ${this.hasPermission('ctzn.network/perm-community-manage-roles') ? html`
            <ctzn-button btn-class="text-sm px-3 py-0 ml-1 rounded-3xl" label="Create Role" @click=${this.onCreateRole}></ctzn-button>
          ` : ''}
        </div>
        <div class="border border-gray-200 border-t-0 border-b-0  bg-white">
          ${renderRole('admin')}
          ${repeat(this.roles || [], r => r.value.roleId, r => renderRole(r.value.roleId, r.value.permissions))}
          <div class="px-4 py-2 border-b border-gray-300">
            <div class="flex items-center">
              <span class="font-semibold text-lg flex-1"><span class="text-sm far fa-fw fa-user"></span> default</span>
            </div>
            <div class="text-gray-500">
              <div>&bull; Can join or leave the community.</div>
              <div>&bull; Can create and delete posts.</div>
              <div>&bull; Can create and delete comments.</div>
            </div>
            <div class="flex px-4 py-2 mt-2 rounded bg-gray-100 text-gray-500">
              This role includes everybody.
            </div>
          </div>
        </div>
        ${this.hasPermission('ctzn.network/perm-community-ban') ? html`
          <div class="border border-t-0 border-gray-200 px-3 py-2">
            <ctzn-button btn-class="text-sm px-4 py-1 ml-1 rounded-3xl" label="Manage Banned Users" @click=${this.onClickManageBans}></ctzn-button>
          </div>
        ` : ''}
      `
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

  renderEmptyMessage () {
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center border border-t-0 border-gray-200">
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
          await session.ctzn.blob.update('avatar', newProfile.uploadedAvatar.base64buf)
        } else if (this.isCommunity) {
          const blobRes = await session.ctzn.blob.create(newProfile.uploadedAvatar.base64buf)
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
      if (!isPending) {
        toast.create('Profile updated', 'success')
      }
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
    await session.ctzn.user.table('ctzn.network/follow').create({
      subject: {userId: this.userId, dbUrl: this.userProfile.dbUrl}
    })
    this.followers = await session.ctzn.listFollowers(this.userId)
    this.uniqFollowers = Array.from(getUniqFollowers(this.followers))
  }

  async onClickUnfollow (e) {
    await session.ctzn.user.table('ctzn.network/follow').delete(this.userId)
    this.followers = await session.ctzn.listFollowers(this.userId)
    this.uniqFollowers = Array.from(getUniqFollowers(this.followers))
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
      items.push({label: 'View activity log', click: () => setView('activity')})
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

  onClickNavMore (e) {
    e.preventDefault()
    e.stopPropagation()

    const setView = (view) => {
      emit(this, 'navigate-to', {detail: {url: `/${this.userId}/${view}`}})
    }

    let items = []
    if (this.isCitizen) {
      items = [
        {label: 'Following', click: () => setView('following')},
        {label: 'Communities', click: () => setView('communities')}
      ]
    }
    let rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right,
      y: rect.bottom,
      right: true,
      roomy: true,
      noBorders: true,
      style: `padding: 4px 0; font-size: 16px; font-weight: 500`,
      items
    })
  }
}

customElements.define('ctzn-user-view', CtznUser)

function getUniqFollowers (followers) {
  return new Set(followers.community.concat(followers.myCommunity || []).concat(followers.myFollowed || []))
}

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