import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import { CreateCommunityPopup } from './popups/create-community.js'
import './button.js'

const CHECK_NOTIFICATIONS_INTERVAL = 10e3

export class Header extends LitElement {
  static get properties () {
    return {
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
    this.isMenuOpen = false
    this.unreadNotificationsCount = 0
    this.community = undefined
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
    const additions = str === location.pathname ? 'text-blue-600' : ''
    return `pl-3 pr-4 py-3 font-semibold rounded hover:bg-gray-200 ${additions}`
  }

  getMobileNavClass (str) {
    const additions = str === location.pathname ? 'text-blue-600' : 'text-gray-500'
    return `px-6 py-2 text-xl font-semibold ${additions}`
  }

  render () {
    let info = session.getSavedInfo()
    return html`
      <header>
        <div class="menu ${this.isMenuOpen ? 'open transition-enabled' : 'closed'} flex flex-col leading-none text-lg bg-gray-100">
          <div class="hidden lg:block px-3 pt-2.5 pb-1">
            <div class="font-bold text-3xl text-gray-800">
              CTZN
              <span class="text-lg text-gray-500 tracking-tight">alpha</span>
            </div>
          </div>
          ${session.hasOneSaved() ? html`
            <div class="px-2 pb-3 mb-3 flex flex-col">
              <a href="/" class=${this.getMenuNavClass('/')}>
                <span class="fas mr-1.5 fa-fw navicon fa-home"></span>
                Home
              </a>
              <a href="/notifications" class="relative ${this.getMenuNavClass('/notifications')}">
                ${this.unreadNotificationsCount > 0 ? html`
                  <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 5px; left: 22px">${this.unreadNotificationsCount}</span>
                ` : ''}
                <span class="fas mr-1.5 fa-fw navicon fa-bell"></span>
                Notifications
              </a>
              ${''/*<a href="/communities" class="${this.getMenuNavClass('/communities')}">
                <span class="fas mr-1.5 fa-fw navicon fa-users"></span>
                Communities
              </a>*/}
              <a
                class="relative ${this.getMenuNavClass()} mt-1"
                href="/${info.userId}"
                title=${info.userId}
              >
                <img class="absolute inline-block w-7 h-7 object-cover rounded" src=${AVATAR_URL(info.userId)} style="left: 10px; top: 6px">
                <span class="inline-block" style="width: 29px"></span>
                Profile
              </a>
            </div>
          ` : ''}
          ${session.hasOneSaved() ? html`
            <h3 class="font-bold pl-4 mb-1 text-gray-500 text-xs">
              My Communities
            </h3>
            <div class="flex-grow px-2 mb-1 overflow-y-auto">
              <div class="mt-2">
                ${session.myCommunities?.length ? html`
                  ${repeat(session.myCommunities.slice(0, 7), community => html`
                    <a
                      class="flex items-center pl-2 pr-4 py-1 text-sm rounded hover:bg-gray-200"
                      href="/${community.userId}"
                    >
                      <img
                        class="w-8 h-8 object-cover rounded-md mr-2"
                        src=${AVATAR_URL(community.userId)}
                      >
                      <span class="truncate font-medium">${displayNames.render(community.userId)}</span>
                    </a>
                  `)}
                ` : html`
                  <div class="pl-2 pr-5 text-base text-gray-700">
                    Join a community to get connected to more people!
                  </div>
                `}
                <a
                  class="flex items-center pl-2 pr-4 py-1 text-sm rounded cursor-pointer hover:bg-gray-200"
                  @click=${this.onClickCreateCommunity}
                >
                  <span
                    class="w-8 py-1.5 text-center object-cover rounded-md mr-2 text-white"
                    style="background: linear-gradient(45deg, #2663eb, #2e26eb)"
                  ><span class="fas fa-plus"></span></span>
                  <span class="truncate font-semibold text-gray-600">Create community</span>
                </a>
                <a
                  class="flex items-center pl-2 pr-4 py-1 text-sm rounded cursor-pointer hover:bg-gray-200"
                  href="/communities"
                >
                  <span
                    class="w-8 py-1.5 text-center object-cover rounded-md mr-2 text-white"
                    style="background: linear-gradient(45deg, #2663eb, #2e26eb)"
                  ><span class="fas fa-users"></span></span>
                  <span class="truncate font-semibold text-gray-600">Browse</span>
                </a>
              </div>
            </div>
          ` : ''}
          <div class="py-3 px-2">
            ${this.renderSessionCtrls()}
          </div>
        </div>
        <div class="mobile-bot box-border flex">
          <a href="/" class="flex-1 text-center ${this.getMobileNavClass('/')}" @click=${this.onClickBotNavHome}>
            <span class="fas fa-fw navicon fa-home"></span>
          </a>
          <a href="/communities" class="flex-1 text-center ${this.getMobileNavClass('/communities')}">
            <span class="fas fa-fw navicon fa-users"></span>
          </a>
          ${session.hasOneSaved() ? html`
            <span class="flex-1 px-4 py-2">
              <span
                class="bg-blue-500 flex h-12 items-center justify-center relative rounded-full shadow-md text-white w-12"
                @click=${this.onClickCreatePost}
                style="top: -20px;"
              ><span class="fas fa-plus"></span></span>
            </span>
            <a href="/notifications" class="relative flex-1 text-center ${this.getMobileNavClass('/notifications')}">
              ${this.unreadNotificationsCount > 0 ? html`
                <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 8px; right: calc(50% - 24px);">${this.unreadNotificationsCount}</span>
              ` : ''}
              <span class="fas fa-fw navicon fa-bell"></span>
            </a>
          ` : html`<span class="flex-1"></span>`}
          <a class="flex-1 text-center ${this.getMobileNavClass()}" @click=${this.onToggleMenu}>
            <span class="fas fa-fw fa-bars"></span>
          </a>
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

  renderSessionCtrls () {
    if (session.hasOneSaved()) {
      return html`
        <div class="lg:pb-6 flex flex-col">
          <a class=${this.getMenuNavClass('/account')} href="/account"><span class="fas fa-fw fa-cog mr-1.5"></span> Account</a>
          <a class=${this.getMenuNavClass()} href="#" @click=${this.onLogOut}>
            <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
          </a>
        </div>
      `
    } else {
      return html`
        <div class="flex flex-col">
          <a class=${this.getMenuNavClass()} href="/"><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
          <a class=${this.getMenuNavClass()} href="/signup"><span class="fas fa-fw fa-user-plus mr-1.5"></span> <strong>Sign up</strong></a>
        </div>
      `
    }
  }

  // events
  // =

  onToggleMenu (e) {
    this.isMenuOpen = !this.isMenuOpen
  }

  onClickMenuOverlay (e) {
    this.isMenuOpen = false
  }

  async onClickNewPost (e) {
    e.preventDefault()
    window.location = '/?composer'
  }

  async onLogOut () {
    await session.doLogout()
    location.reload()
  }

  onClickBotNavHome (e) {
    if (window.location.pathname === '/') {
      e.preventDefault()
      window.scrollTo(0, 0)
      window.closePopup?.()
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

customElements.define('ctzn-header', Header)
