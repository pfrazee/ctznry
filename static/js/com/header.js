import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import './button.js'

const CHECK_NOTIFICATIONS_INTERVAL = 5e3

export class Header extends LitElement {
  static get properties () {
    return {
      unreadNotificationsCount: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
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

  getNavClass (str) {
    const additions = str === location.pathname ? 'text-blue-700' : ''
    return `pl-3 pr-4 py-3 font-semibold rounded hover:bg-gray-100 ${additions}`
  }

  render () {
    return html`
      <div class="fixed z-10" style="top: 10px; left: calc(50vw - 680px); height: calc(100vh - 20px)">
        <header class="max-w-4xl mx-auto flex flex-col leading-none text-lg h-full">
          <span class="font-bold px-3 py-2 text-3xl text-gray-600">
            C T Z N R Y
          </span>
          <a href="/" class=${this.getNavClass('/')}>
            <span class="fas mr-1.5 fa-fw navicon fa-stream"></span>
            Home
          </a>
          ${session.isActive() ? html`
            <a href="/notifications" class=${this.getNavClass('/notifications')}>
              <span class="far mr-1.5 fa-fw navicon fa-bell"></span>
              Notifications ${this.unreadNotificationsCount > 0 ? `(${this.unreadNotificationsCount})` : ''}
            </a>
          ` : ''}
          ${this.renderSessionCtrls()}
        </header>
      </div>
    `
  }

  renderSessionCtrls () {
    if (session.hasOneSaved()) {
      let info = session.getSavedInfo()
      return html`
        <a
          class="relative ${this.getNavClass()} mt-1"
          href="/${info.userId}"
          title=${info.userId}
        >
          <img class="absolute inline-block w-7 h-7 object-cover rounded-full" src=${AVATAR_URL(info.userId)} style="left: 10px; top: 6px">
          <span class="inline-block" style="width: 29px"></span>
          Profile
        </a>
        <span class="flex-grow"></span>
        <a class=${this.getNavClass()} href="#" @click=${this.onLogOut}>
          <span class="fas fa-fw fa-sign-out-alt mr-1.5"></span> Log out
        </a>
      `
    } else {
      return html`
        <a class=${this.getNavClass()} href="/login"><span class="fas fa-fw fa-sign-in-alt mr-1.5"></span> Log in</a>
        <a class=${this.getNavClass()} href="/signup"><span class="fas fa-fw fa-user-plus mr-1.5"></span> <strong>Sign up</strong></a>
      `
    }
  }

  // events
  // =

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
