import { LitElement, html } from '../../vendor/lit/lit.min.js'
import * as toast from '../com/toast.js'
import * as notifications from '../lib/notifications.js'
import '../com/header.js'
import '../com/button.js'
import '../com/notifications-feed.js'
import '../com/suggestions-sidebar.js'
import '../com/subnav.js'

class CtznNotificationsView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      numUnreadNotifications: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.numUnreadNotifications = 0
  }

  async load () {
    document.title = `Notifications | CTZN`
    if (document.hasFocus()) {
      notifications.updateClearedAt()
    }
    await this.querySelector('app-notifications-feed')?.load()
  }

  async refresh () {
    await this.querySelector('app-notifications-feed')?.load()
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    this.querySelector('app-notifications-feed')?.pageLoadScrollTo(y)
  }

  // rendering
  // =

  render () {
    const SUBNAV_ITEMS = [
      {menu: true, mobileOnly: true, label: html`<span class="fas fa-bars"></span>`},
      {path: '/', label: 'Feed'},
      {path: '/inbox', label: 'Inbox'},
      {
        path: '/notifications',
        label: html`
          ${this.numUnreadNotifications > 0 ? html`
            <span class="inline-block text-sm px-2 bg-blue-600 text-white rounded-full">${this.numUnreadNotifications}</span>
          ` : ''}
          Notifications
        `
      },
      {path: '/search', label: 'Search'}
    ]
    return html`
      <app-header
        current-path=${this.currentPath}
        @post-created=${e => this.load()}
        @unread-notifications-changed=${this.onUnreadNotificationsChanged}
      ></app-header>
      <main class="col2">
        <div>
          <app-subnav
            mobile-only
            nav-cls=""
            .items=${SUBNAV_ITEMS}
            current-path=${this.currentPath}
          ></app-subnav>
          <h2 class="text-2xl tracking-tight font-bold p-4 border-l border-r border-gray-300 hidden lg:block">Notifications</h2>
          <app-notifications-feed
            .clearedAt=${this.notificationsClearedAt}
            @publish-reply=${this.onPublishReply}
          ></app-notifications-feed>
        </div>
        ${this.renderRightSidebar()}
      </main>
    `
  }

  renderRightSidebar () {
    return html`
      <nav class="pt-6">
        <app-suggestions-sidebar></app-suggestions-sidebar>
      </nav>
    `
  }

  // events
  // =


  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  onUnreadNotificationsChanged (e) {
    this.numUnreadNotifications = e.detail.count
    document.title = e.detail.count ? `(${e.detail.count}) Notifications | CTZN` : `Notifications | CTZN`
    this.querySelector('app-notifications-feed').loadNew(e.detail.count)
    if (document.hasFocus() && this.id === 'view') {
      notifications.updateClearedAt()
    }
  }
}

customElements.define('app-notifications-view', CtznNotificationsView)