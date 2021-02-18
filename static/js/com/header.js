import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import './button.js'

const CHECK_NOTIFICATIONS_INTERVAL = 5e3

export class Header extends LitElement {
  static get properties () {
    return {
      isMenuOpen: {type: Boolean},
      unreadNotificationsCount: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isMenuOpen = false
    this.unreadNotificationsCount = 0
    setInterval(this.checkNotifications.bind(this), CHECK_NOTIFICATIONS_INTERVAL)
    session.onChange(() => this.requestUpdate())
  }

  updated () {
    this.checkNotifications()
  }

  async checkNotifications () {
    if (!session.isActive()) return
    const clearedAt = (await session.api.notifications.getNotificationsClearedAt()) || undefined
    this.unreadNotificationsCount = await session.api.notifications.count({after: clearedAt})
  }

  getMenuNavClass (str) {
    const additions = str === location.pathname ? 'text-blue-700' : ''
    return `pl-3 pr-4 py-3 font-semibold rounded hover:bg-gray-100 ${additions}`
  }

  getMobileNavClass (str) {
    const additions = str === location.pathname ? 'text-blue-700' : ''
    return `px-6 py-2 text-2xl font-semibold rounded hover:bg-gray-100 ${additions}`
  }

  render () {
    let info = session.getSavedInfo()
    return html`
      <header>
        <div class="menu ${this.isMenuOpen ? 'open' : 'closed'} flex flex-col leading-none text-lg bg-white">
          <span class="font-bold px-3 py-2 text-3xl text-gray-600">
            C T Z N
          </span>
          <a href="/" class=${this.getMenuNavClass('/')}>
            <span class="fas mr-1.5 fa-fw navicon fa-home"></span>
            Home
          </a>
          ${session.hasOneSaved() ? html`
            <a href="/notifications" class=${this.getMenuNavClass('/notifications')}>
              <span class="far mr-1.5 fa-fw navicon fa-bell"></span>
              Notifications ${this.unreadNotificationsCount > 0 ? `(${this.unreadNotificationsCount})` : ''}
            </a>
          ` : ''}
          ${this.renderSessionCtrls()}
        </div>
        <div class="mobile-top box-border flex bg-white border-b border-gray-300">
          <a class=${this.getMobileNavClass()} @click=${this.onToggleMenu}>
            <span class="fas fa-fw fa-bars"></span>
          </a>
          <span class="flex-grow"></span>
          <a class="font-bold px-3 py-2 text-2xl text-gray-600" href="/">
            C T Z N
          </a>
          <span class="flex-grow"></span>
          ${session.hasOneSaved() ? html`
              <a href="/${info.userId}" title=${info.userId} class="p-1.5 px-5">
                <img class="inline-block w-9 h-9 object-cover rounded-full" src=${AVATAR_URL(info.userId)}>
              </a>
            ` : html`
              <a href="/login"><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
            `
          }
        </div>
        <div class="mobile-bot box-border flex bg-white border-t border-gray-300">
          <a href="/" class="flex-1 text-center ${this.getMobileNavClass('/')}">
            <span class="fas fa-fw navicon fa-home"></span>
          </a>
          ${session.hasOneSaved() ? html`
            <a href="/notifications" class="flex-1 text-center ${this.getMobileNavClass('/notifications')}">
              <span class="far fa-fw navicon fa-bell"></span>
              ${this.unreadNotificationsCount > 0 ? `(${this.unreadNotificationsCount})` : ''}
            </a>
          ` : html`<span class="flex-1"></span>`}
          <span class="flex-1"></span>
          <span class="flex-1"></span>
        </div>
      </header>
    `
  }

  renderSessionCtrls () {
    if (session.hasOneSaved()) {
      let info = session.getSavedInfo()
      return html`
        <a
          class="relative ${this.getMenuNavClass()} mt-1"
          href="/${info.userId}"
          title=${info.userId}
        >
          <img class="absolute inline-block w-7 h-7 object-cover rounded-full" src=${AVATAR_URL(info.userId)} style="left: 10px; top: 6px">
          <span class="inline-block" style="width: 29px"></span>
          Profile
        </a>
        <span class="flex-grow"></span>
        <a class=${this.getMenuNavClass()} href="#" @click=${this.onLogOut}>
          <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
        </a>
      `
    } else {
      return html`
        <a class=${this.getMenuNavClass()} href="/login"><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
        <a class=${this.getMenuNavClass()} href="/signup"><span class="fas fa-fw fa-user-plus mr-1.5"></span> <strong>Sign up</strong></a>
      `
    }
  }

  // events
  // =

  onToggleMenu (e) {
    this.isMenuOpen = !this.isMenuOpen
  }

  async onClickNewPost (e) {
    e.preventDefault()
    window.location = '/?composer'
  }

  async onLogOut () {
    await session.doLogout()
    location.reload()
  }
}

customElements.define('ctzn-header', Header)
