import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import { ComposerPopup } from './popups/composer.js'
import { CreateCommunityPopup } from './popups/create-community.js'
import * as toast from './toast.js'
import './button.js'

const CHECK_NOTIFICATIONS_INTERVAL = 10e3
const HEADER_HEIGHT = 50

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

    // hide the header menu on scrolls (in mobile)
    let lastScrollY = window.pageYOffset || 0
    setInterval(() => {
      const scrollY = window.pageYOffset
      if (Math.abs(lastScrollY - scrollY) <= 5) {
        return
      }
      if (scrollY > HEADER_HEIGHT && scrollY > lastScrollY) {
        this.querySelector('.mobile-top').classList.add('hidden')
      } else {
        this.querySelector('.mobile-top').classList.remove('hidden')
      }
      lastScrollY = scrollY
    }, 250)

    // detect swipes to the right and open the menu
    let touchstartX = 0
    let touchstartY = 0
    document.body.addEventListener('touchstart', event => {
      touchstartX = event.changedTouches[0].screenX
      touchstartY = event.changedTouches[0].screenY
    }, false)
    document.body.addEventListener('touchend', event => {
      let touchendX = event.changedTouches[0].screenX
      let touchendY = event.changedTouches[0].screenY
      let diffX = touchendX - touchstartX
      let diffY = touchendY - touchstartY
      let diffXNormalized = diffX / Math.abs(diffY + 1)
      if (diffX > 100 && diffXNormalized > 10) {
        this.isMenuOpen = true
      }
    }, false);
  }

  firstUpdated () {
    this.checkNotifications()
  }

  async checkNotifications () {
    if (!session.isActive()) return
    const clearedAt = (await session.api.notifications.getNotificationsClearedAt()) || undefined
    let oldCount = this.unreadNotificationsCount
    this.unreadNotificationsCount = await session.api.notifications.count({after: clearedAt})
    if (oldCount !== this.unreadNotificationsCount) {
      emit(this, 'unread-notifications-changed', {detail: {count: this.unreadNotificationsCount}})
    }
  }

  getMenuNavClass (str) {
    const additions = str === location.pathname ? 'text-blue-600' : ''
    return `pl-3 pr-4 py-3 font-semibold rounded hover:bg-gray-100 ${additions}`
  }

  getMobileNavClass (str) {
    const additions = str === location.pathname ? 'text-blue-600' : 'text-gray-500'
    return `px-6 py-2 text-xl font-semibold ${additions}`
  }

  render () {
    let info = session.getSavedInfo()
    return html`
      <header>
        <div class="menu ${this.isMenuOpen ? 'open transition-enabled' : 'closed'} flex flex-col leading-none text-lg bg-gray-50 pt-12 lg:pt-0">
          <div class="px-3 py-2 hidden lg:block">
            <div class="font-bold text-3xl text-gray-800">CTZN</div>
            <div class="font-bold pl-0.5 text-gray-500 tracking-tight">alpha</div>
          </div>
          <a href="/" class=${this.getMenuNavClass('/')}>
            <span class="fas mr-1.5 fa-fw navicon fa-home"></span>
            Home
          </a>
          ${session.hasOneSaved() ? html`
            <a href="/notifications" class="relative ${this.getMenuNavClass('/notifications')}">
              ${this.unreadNotificationsCount > 0 ? html`
                <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 5px; left: 22px">${this.unreadNotificationsCount}</span>
              ` : ''}
              <span class="fas mr-1.5 fa-fw navicon fa-bell"></span>
              Notifications
            </a>
          ` : ''}
          <a href="/communities" class=${this.getMenuNavClass('/communities')}>
            <span class="fas mr-1.5 fa-fw navicon fa-users"></span>
            Communities
          </a>
          ${session.hasOneSaved() ? html`
            <a
              class="relative ${this.getMenuNavClass()} mt-1"
              href="/${info.userId}"
              title=${info.userId}
            >
              <img class="absolute inline-block w-7 h-7 object-cover rounded-full" src=${AVATAR_URL(info.userId)} style="left: 10px; top: 6px">
              <span class="inline-block" style="width: 29px"></span>
              Profile
            </a>
            <div class="mt-6 px-1">
              <ctzn-button
                primary
                btn-class="text-sm font-semibold w-full mb-2 rounded-3xl"
                label="Create Post"
                @click=${this.onClickCreatePost}
              ></ctzn-button>
              <ctzn-button
                btn-class="text-gray-600 text-sm font-semibold w-full rounded-3xl"
                label="Create Community"
                @click=${this.onClickCreateCommunity}
              ></ctzn-button>
            </div>
          ` : ''}
          ${this.renderSessionCtrls()}
        </div>
        <div class="mobile-top box-border flex bg-white border-b border-gray-300">
          <a class="font-semibold px-4 py-3 text-gray-500" @click=${this.onToggleMenu}>
            <span class="fas fa-fw fa-bars"></span>
          </a>
          <span class="flex-grow"></span>
          <a class="font-bold px-3 py-2 text-2xl text-gray-800" href="/" @click=${this.onClickTopNavCTZN}>
            C T Z N <span class="text-gray-500 tracking-tight">alpha</span>
          </a>
          <span class="flex-grow"></span>
          ${session.hasOneSaved()
            ? html`
              <a href="/${info.userId}" title=${info.userId} class="p-1.5 px-5">
                <img class="inline-block w-9 h-9 object-cover rounded-full" src=${AVATAR_URL(info.userId)}>
              </a>
            ` : html`
              <a href="/" class="px-4 py-2 text-lg text-blue-600" style="line-height: 1.8">Log in</a>
            `
          }
        </div>
        <div class="mobile-bot box-border flex bg-white border-t border-gray-300">
          <a href="/" class="flex-1 text-center ${this.getMobileNavClass('/')}">
            <span class="fas fa-fw navicon fa-home"></span>
          </a>
          ${session.hasOneSaved() ? html`
            <a href="/notifications" class="relative flex-1 text-center ${this.getMobileNavClass('/notifications')}">
              ${this.unreadNotificationsCount > 0 ? html`
                <span class="absolute bg-blue-500 font-medium leading-none px-1.5 py-0.5 rounded-2xl text-white text-xs" style="top: 8px; right: calc(50% - 24px);">${this.unreadNotificationsCount}</span>
              ` : ''}
              <span class="fas fa-fw navicon fa-bell"></span>
            </a>
          ` : html`<span class="flex-1"></span>`}
          <a href="/communities" class="flex-1 text-center ${this.getMobileNavClass('/communities')}">
            <span class="fas fa-fw navicon fa-users"></span>
          </a>
          <span class="flex-1 px-6 py-2">
            <span class="fas fa-fw navicon fa-users" style="visibility: hidden"></span>
          </span>
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
        <span class="hidden lg:block lg:flex-grow"></span>
        <div class="pb-6 pt-6 lg:pt-0 flex flex-col">
          <a class=${this.getMenuNavClass('/account')} href="/account"><span class="fas fa-fw fa-cog mr-1.5"></span> Account</a>
          <a class=${this.getMenuNavClass()} href="#" @click=${this.onLogOut}>
            <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
          </a>
        </div>
      `
    } else {
      return html`
        <a class=${this.getMenuNavClass()} href="/"><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
        <a class=${this.getMenuNavClass()} href="/signup"><span class="fas fa-fw fa-user-plus mr-1.5"></span> <strong>Sign up</strong></a>
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

  onClickTopNavCTZN (e) {
    if (window.location.pathname === '/') {
      e.preventDefault()
      window.scrollTo(0, 0)
      window.closePopup?.()
    }
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

customElements.define('ctzn-header', Header)
