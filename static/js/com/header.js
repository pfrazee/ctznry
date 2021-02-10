import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import * as contextMenu from './context-menu.js'
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
    const additions = str === location.pathname ? 'border-blue-500' : ''
    return `p-3.5 pb-3 border-b-2 border-solid border-transparent hover:bg-gray-100 ${additions}`
  }

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <div class="bg-white border-b border-gray-300 border-solid mb-4">
        <header class="max-w-4xl mx-auto flex items-center ph-2 leading-none">
          <a href="/" class=${this.getNavClass('/')}>
            <span class="fas navicon fa-stream"></span>
            Home
          </a>
          ${session.isActive() ? html`
            <a href="/notifications" class=${this.getNavClass('/notifications')}>
              <span class="far navicon fa-bell"></span>
              Notifications ${this.unreadNotificationsCount > 0 ? `(${this.unreadNotificationsCount})` : ''}
            </a>
          ` : ''}
          <span class="flex-grow"></span>
          ${this.renderSessionCtrls()}
        </header>
      </div>
    `
  }

  renderSessionCtrls () {
    if (session.isActive()) {
      return html`
        <ctzn-button primary @click=${this.onClickNewPost} label="New Post"></ctzn-button>
        <a
          class="inline-flex items-center px-1 ml-2.5"
          href="/${session.info.userId}"
          title=${session.info.userId}
        >
          <img class="inline-block w-7 h-7 object-cover rounded-full" src=${AVATAR_URL(session.info.userId)}>
        </a>
        <a @click=${this.onClickSessionMenu} class=${this.getNavClass()} href="#"><span class="fas fa-caret-down"></span></a>
      `
    } else {
      return html`
        <a class=${this.getNavClass()} href="/login">Log in</a>
        <a class=${this.getNavClass()} href="/signup"><strong>Sign up</strong></a>
      `
    }
  }

  // events
  // =

  async onClickNewPost (e) {
    e.preventDefault()
    window.location = '/?composer'
  }

  onClickSessionMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right,
      y: rect.bottom,
      right: true,
      roomy: true,
      items: [
        {
          label: 'Log out',
          click: async () => {
            await session.doLogout()
            location.reload()
          }
        }
      ]
    })
  }
}

customElements.define('ctzn-header', Header)
