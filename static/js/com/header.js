import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import { ComposerPopup } from './popups/composer.js'
import { CreateCommunityPopup } from './popups/create-community.js'
import * as toast from './toast.js'
import './button.js'

import {DEFAULT_CITIZEN_PROFILE_SECTIONS} from '../lib/const.js'

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
    this.sections = DEFAULT_CITIZEN_PROFILE_SECTIONS

    document.body.addEventListener('open-main-menu', e => {
      this.isMenuOpen = true
    })
    setInterval(this.checkNotifications.bind(this), CHECK_NOTIFICATIONS_INTERVAL)
    session.onChange(() =>  this.requestUpdate())
    session.onSecondaryState(() =>  this.requestUpdate())
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
    let info = session.getSavedInfo()
    return html`
      <header>
        <div class="menu ${this.isMenuOpen ? 'open transition-enabled' : 'closed'} flex flex-col leading-none text-xl sm:leading-none sm:text-lg bg-white">
          <div class="hidden lg:block px-3 pt-2.5 pb-1">
            <div class="font-bold text-3xl text-gray-800">
              CTZN
              <span class="text-lg text-gray-500 tracking-tight">alpha</span>
            </div>
          </div>
          ${session.hasOneSaved() ? html`
            <div class="flex flex-col px-2 h-full sm:h-auto">
              <div
                class="sm:hidden flex flex-1 items-center justify-center mt-2 mb-3 rounded"
                style="background: linear-gradient(45deg, #d800ff, #008cff)"
              >
                <div class="font-black text-4xl text-white">
                  CTZN
                  <span class="font-bold opacity-80 text-2xl">alpha</span>
                </div>
              </div>
              <hr class="my-3 mx-3 hidden sm:block">
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
              <hr class="my-3 mx-3">
              <a
                class="flex items-center ${this.getMenuNavClass()} mt-1"
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
              ${session.mySections?.length > 0 ? repeat(session.mySections, (section) => {
                return html`<a href="/${info?.userId}/${section.id}"
                  class=${this.getMenuNavClass()}
                  @click=${this.onClickLink}>
                    <span class="fas mr-1.5 fa-fw navicon fa-angle-right"></span>
                      ${section.label}
                  </a>`
              }) : ''}
                  <hr class="my-3 mx-3"></hr>
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
          ` : ''}
          <div class="py-3 px-2">
            ${this.renderSessionCtrls()}
          </div>
        </div>
        <div class="secondary-menu bg-white overflow-y-auto px-2 py-2">
          <a
            class="flex items-center pl-2 pr-4 py-1 text-sm rounded hov:hover:bg-gray-100"
            href="/${info.userId}"
            title=${info.userId}
          >
            <img class="w-8 h-8 object-cover rounded-md mr-2" src=${AVATAR_URL(info.userId)} style="left: 10px; top: 6px">
            ${displayNames.render(info.userId)}
          </a>
          <h3 class="font-bold pl-2 mt-4 mb-2 text-gray-500 text-xs">
            My Communities
          </h3>
          <div class="mb-4">
            ${session.myCommunities?.length ? html`
              ${repeat(session.myCommunities, community => html`
                <a
                  class="flex items-center pl-2 pr-4 py-1 text-sm rounded hov:hover:bg-gray-100"
                  href="/${community.userId}"
                >
                  <img
                    class="lazyload w-8 h-8 object-cover rounded-md mr-2"
                    data-src=${AVATAR_URL(community.userId)}
                  >
                  <span class="truncate font-medium">${displayNames.render(community.userId)}</span>
                </a>
              `)}
            ` : html`
              <div class="pl-2 pr-5 mb-1 text-base text-gray-700">
                Join a community to get connected to more people!
              </div>
            `}
            <a
              class="flex items-center pl-2 pr-4 py-1 text-sm rounded cursor-pointer hov:hover:bg-gray-100"
              @click=${this.onClickCreateCommunity}
            >
              <span
                class="w-8 py-1.5 text-center object-cover rounded-md mr-2 bg-gray-300 text-gray-600"
              ><span class="fas fa-plus"></span></span>
              <span class="truncate font-semibold text-gray-600">Create community</span>
            </a>
            <a
              class="flex items-center pl-2 pr-4 py-1 text-sm rounded cursor-pointer hov:hover:bg-gray-100"
              href="/communities"
            >
              <span
                class="w-8 py-1.5 text-center object-cover rounded-md mr-2 bg-gray-300 text-gray-600"
              ><span class="fas fa-users"></span></span>
              <span class="truncate font-semibold text-gray-600">Browse</span>
            </a>
          </div>
          <h3 class="font-bold pl-2 mb-2 text-gray-500 text-xs">
            My Follows
          </h3>
          ${repeat(session.myFollowing || [], f => f, f => html`
            <a
              class="flex items-center pl-2 pr-4 py-1 text-sm rounded hov:hover:bg-gray-100"
              href="/${f}"
            >
              <img
                class="lazyload w-8 h-8 object-cover rounded-md mr-2"
                data-src=${AVATAR_URL(f)}
              >
              <span class="truncate font-medium">${displayNames.render(f)}</span>
            </a>
          `)}
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
        <div class="pb-16 sm:pb-6 flex flex-col">
          <a class=${this.getMenuNavClass('/account')} href="/account" @click=${this.onClickLink}><span class="fas fa-fw fa-cog mr-1.5"></span> Account</a>
          <a class=${this.getMenuNavClass()} href="#" @click=${this.onLogOut}>
            <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
          </a>
        </div>
      `
    } else {
      return html`
        <div class="flex flex-col">
          <a class=${this.getMenuNavClass()} href="/" @click=${this.onClickLink}><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
          <a class=${this.getMenuNavClass()} href="/signup" @click=${this.onClickLink}><span class="fas fa-fw fa-user-plus mr-1.5"></span> <strong>Sign up</strong></a>
        </div>
      `
    }
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
