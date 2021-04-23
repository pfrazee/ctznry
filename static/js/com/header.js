import {LitElement, html} from '../../vendor/lit/lit.min.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import { ComposerPopup } from './popups/composer.js'
import { CreateCommunityPopup } from './popups/create-community.js'
import * as toast from './toast.js'
import './button.js'
import './searchable-user-list.js'

const CHECK_NOTIFICATIONS_INTERVAL = 10e3

export class Header extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      isMenuOpen: {type: Boolean},
      unreadNotificationsCount: {type: Number},
      community: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.currentPath = location.pathname
    this.isMenuOpen = false
    this.unreadNotificationsCount = 0
    this.community = undefined
    document.body.addEventListener('open-main-menu', e => {
      this.isMenuOpen = true
    })
    setInterval(this.checkNotifications.bind(this), CHECK_NOTIFICATIONS_INTERVAL)
    session.onChange(() => this.requestUpdate())
  }

  firstUpdated () {
    this.checkNotifications()
  }

  async checkNotifications () {
    if (!session.isActive()) return
    const clearedAt = (await session.ctzn.view('ctzn.network/notifications-cleared-at-view'))?.notificationsClearedAt || undefined
    let oldCount = this.unreadNotificationsCount
    this.unreadNotificationsCount = (await session.ctzn.view('ctzn.network/notifications-count-view', {after: clearedAt})).count
    if (oldCount !== this.unreadNotificationsCount) {
      emit(this, 'unread-notifications-changed', {detail: {count: this.unreadNotificationsCount}})
    }
  }

  getMenuNavClass (str) {
    const additions = str === this.currentPath ? 'text-blue-600' : ''
    return `pl-3 pr-4 py-3 font-semibold rounded hov:hover:bg-gray-100 ${additions}`
  }

  render () {
    if (!session.isActive()) {
      return this.renderLoggedOut()
    }
    let info = session.getSavedInfo()
    return html`
      <header>
        <div class="menu ${this.isMenuOpen ? 'open transition-enabled' : 'closed'} flex flex-col leading-none text-xl sm:leading-none sm:text-lg bg-white">
          <div class="mobile-only flex-1 bg-gray-50 mb-2"></div>
          <div class="px-4 pt-2.5 pb-1">
            <div class="font-bold text-3xl text-gray-800">
              CTZN
              <span class="text-lg text-gray-500 tracking-tight">alpha</span>
            </div>
          </div>
          <div class="flex flex-col px-2">
            <hr class="my-3 mx-3">
            <a href="/" class=${this.getMenuNavClass('/')} @click=${this.onClickLink}>
              <span class="fas mr-1.5 fa-fw navicon fa-home"></span>
              Home
            </a>
            <a href="/notifications" class="relative ${this.getMenuNavClass('/notifications')}" @click=${this.onClickLink}>
              ${this.unreadNotificationsCount > 0 ? html`
                <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 5px; left: 22px">${this.unreadNotificationsCount}</span>
              ` : ''}
              <span class="fas mr-1.5 fa-fw navicon fa-bell"></span>
              Notifications
            </a>
            <a href="/communities" class="${this.getMenuNavClass('/communities')}" @click=${this.onClickLink}>
              <span class="fas mr-1.5 fa-fw navicon fa-users"></span>
              Communities
            </a>
            <a
              class="flex items-center ${this.getMenuNavClass()}"
              href="/${info.userId}"
              title=${info.userId}
              @click=${this.onClickLink}
            >
              <span class="inline-block mr-2" style="margin-left: -3px">
                <img
                  class="inline-block w-8 h-8 sm:w-7 sm:h-7 object-cover rounded"
                  src=${AVATAR_URL(info.userId)}
                >
              </span>
              My Profile
            </a>
            <hr class="my-3 mx-3">
          </div>
          <div class="mt-3 sm:mb-auto px-4">
            <app-button
              primary
              btn-class="text-base sm:text-sm font-semibold w-full mb-2 rounded-3xl"
              label="Create Post"
              @click=${this.onClickCreatePost}
            ></app-button>
            <app-button
              btn-class="text-gray-600 text-base sm:text-sm font-semibold w-full rounded-3xl"
              label="Create Community"
              @click=${this.onClickCreateCommunity}
            ></app-button>
            <hr class="mt-5">
          </div>
          <div class="py-3 px-2">
            <div class="pb-16 sm:pb-6 flex flex-col">
              <a class=${this.getMenuNavClass('/account')} href="/account" @click=${this.onClickLink}><span class="fas fa-fw fa-cog mr-1.5"></span> Account</a>
              <a class=${this.getMenuNavClass()} href="#" @click=${this.onLogOut}>
                <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
              </a>
            </div>
          </div>
        </div>
        <div class="secondary-menu bg-white overflow-y-auto px-2 py-2">
          <app-searchable-user-list></app-searchable-user-list>
        </div>
      </header>
      ${this.isMenuOpen ? html`
        <div
          class="fixed top-0 left-0 w-full h-full z-40" style="background: rgba(0, 0, 0, 0.5)"
          @click=${this.onClickMenuOverlay}
        ></div>
      ` : ''}
    `
  }

  renderLoggedOut () {
    return html`
      <header>
        <div class="logged-out-prompt bg-white mb-4">
          <div class="block sm:flex pt-2 pb-4">
            <div class="px-4 sm:px-0 flex-1">
              <div class="font-bold text-3xl text-gray-800">
                CTZN
                <span class="text-lg text-gray-500 tracking-tight">alpha</span>
              </div>
              <div class="text-sm pb-2 text-gray-600">
                (pronounced "Citizen")
              </div>
              <div class="">
                A decentralized social network for communities.
              </div>
            </div>
            <div class="">
              <a class="inline-block px-3 py-3 font-semibold rounded hov:hover:bg-gray-100" href="/" @click=${this.onClickLink}><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
              <a class="inline-block px-3 py-3 font-semibold rounded hov:hover:bg-gray-100" href="/signup" @click=${this.onClickLink}><span class="fas fa-fw fa-user-plus mr-1.5"></span> Sign up</a>
            </div>
          </div>
        </div>
      </header>
    `
  }

  // events
  // =

  onClickLink (e) {
    this.isMenuOpen = false
  }

  onClickMenuOverlay (e) {
    this.isMenuOpen = false
  }

  async onLogOut () {
    await session.doLogout()
    location.reload()
  }

  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isMenuOpen = false
    try {
      await ComposerPopup.create({
        community: this.community
      })
      toast.create('Post published', '', 10e3)
      emit(this, 'post-created')
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  async onClickCreateCommunity (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isMenuOpen = false
    const res = await CreateCommunityPopup.create()
    console.log(res)
    window.location = `/${res.userId}`
  }
}

customElements.define('app-header', Header)
