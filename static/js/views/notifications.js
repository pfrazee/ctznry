import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from '../com/toast.js'
import * as session from '../lib/session.js'
import '../com/header.js'
import '../com/notifications-feed.js'
import '../com/img-fallbacks.js'

class CtznNotifications extends LitElement {
  static get properties () {
    return {
      searchQuery: {type: String},
      isEmpty: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.notificationsClearedAt = undefined
    this.isEmpty = false

    this.load()
  }

  async load () {
    document.title = `Notifications | CTZN`
    if (!session.isActive()) {
      window.location = '/'
      return this.requestUpdate()
    }
    const res = await session.ctzn.view('ctzn.network/notifications-cleared-at-view')
    this.notificationsClearedAt = res?.notificationsClearedAt ? Number(new Date(res?.notificationsClearedAt)) : 0
    await session.api.notifications.updateNotificationsClearedAt()
    return this.requestUpdate()
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('ctzn-notifications-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('ctzn-notifications-feed')
    feed.pageLoadScrollTo(y)
  }

  // rendering
  // =

  render () {
    return html`
      <ctzn-header @unread-notifications-changed=${this.onUnreadNotificationsChanged}></ctzn-header>
      ${this.renderCurrentView()}
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return ''
    }
    return html`
      <main>
        <div class="bg-white">
          <div class="border border-gray-300 border-t-0 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
            Notifications
          </div>
          <ctzn-notifications-feed
            cleared-at=${this.notificationsClearedAt}
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @publish-reply=${this.onPublishReply}
          ></ctzn-notifications-feed>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
        </div>
      </main>
    `
  }

  renderEmptyMessage () {
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center border border-gray-200">
        <div class="fas fa-bell text-6xl text-gray-300 mb-8"></div>
        <div>You have no notifications!</div>
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

  onKeyupSearch (e) {
    if (e.code === 'Enter') {
      window.location = `/search?q=${e.currentTarget.value.toLowerCase()}`
    }
  }

  onClickClearSearch (e) {
    window.location = '/'
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  onUnreadNotificationsChanged (e) {
    document.title = e.detail.count ? `(${e.detail.count}) Notifications | CTZN` : `Notifications | CTZN`
    this.querySelector('ctzn-notifications-feed').loadNew(e.detail.count)
    session.api.notifications.updateNotificationsClearedAt()
  }
}

customElements.define('ctzn-notifications-view', CtznNotifications)
