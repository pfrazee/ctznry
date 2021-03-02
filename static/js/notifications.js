import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import * as toast from './com/toast.js'
import * as session from './lib/session.js'
import { pluralize } from './lib/strings.js'
import './com/header.js'
import './com/notifications-feed.js'
import './com/img-fallbacks.js'

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

  async load ({clearCurrent} = {clearCurrent: false}) {
    await session.setup()
    if (!session.isActive()) {
      window.location = '/'
      return this.requestUpdate()
    }
    this.notificationsClearedAt = Number(new Date(await session.api.notifications.getNotificationsClearedAt()))
    await session.api.notifications.updateNotificationsClearedAt()
    return this.requestUpdate()
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('ctzn-notifications-feed'))
    return !!queryViewEls.find(el => el.isLoading)
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
          <div class="border border-gray-300 border-t-0 border-b-0 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
            Notifications
          </div>
          <ctzn-notifications-feed
            cleared-at=${this.notificationsClearedAt}
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
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

  onViewThread (e) {
    ViewThreadPopup.create({
      subject: e.detail.subject
    })
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }

  onUnreadNotificationsChanged (e) {
    document.title = `(${e.detail.count}) Notifications | CTZN`
  }
}

customElements.define('ctzn-notifications', CtznNotifications)
