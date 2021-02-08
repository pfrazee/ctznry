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
      isEmpty: {type: Boolean},
      numNewItems: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.notificationsClearedAt = undefined
    this.isEmpty = false
    this.numNewItems = 0
    this.loadTime = Date.now()

    this.load()

    setInterval(this.checkNewItems.bind(this), 5e3)
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    await session.setup()
    if (!session.isActive()) {
      return this.requestUpdate()
    }
    this.notificationsClearedAt = Number(new Date(await session.api.notifications.getNotificationsClearedAt()))
    if (this.querySelector('ctzn-notifications-feed')) {
      this.loadTime = Date.now()
      this.numNewItems = 0
      this.querySelector('ctzn-notifications-feed').load({clearCurrent})
    }
    await session.api.notifications.updateNotificationsClearedAt()
    return this.requestUpdate()
  }

  async checkNewItems () {
    // TODO check for new items
    // var query = PATH_QUERIES[location.pathname.slice(1) || 'all']
    // if (!query) return
    // var {count} = await beaker.index.gql(`
    //   query NewItems ($paths: [String!]!, $loadTime: Long!) {
    //     count: recordCount(
    //       paths: $paths
    //       after: {key: "crtime", value: $loadTime}
    //     )
    //   }
    // `, {paths: query, loadTime: this.loadTime})
    // this.numNewItems = count
  }

  get isLoading () {
    let queryViewEls = Array.from(this.querySelectorAll('ctzn-notifications-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <ctzn-header></ctzn-header>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    return html`
      <div class="sidebar">
        <div class="sticky">
          <div class="search-ctrl">
            <span class="fas fa-search"></span>
            ${!!this.searchQuery ? html`
              <a class="clear-search" @click=${this.onClickClearSearch}><span class="fas fa-times"></span></a>
            ` : ''}
            <input @keyup=${this.onKeyupSearch} placeholder="Search" value=${this.searchQuery}>
          </div>
        </div>
      </div>
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return ''
    }
    return html`
      <div class="max-w-3xl mx-auto grid grid-cols-layout-twocol gap-8">
        <div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <div class="reload-page mx-4 mb-4 rounded cursor-pointer overflow-hidden leading-10 ${this.numNewItems > 0 ? 'visible' : ''}" @click=${e => this.load()}>
            ${this.numNewItems} new ${pluralize(this.numNewItems, 'update')}
          </div>
          <ctzn-notifications-feed
            cleared-at=${this.notificationsClearedAt}
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
          ></ctzn-notifications-feed>
        </div>
        ${this.renderRightSidebar()}
      </div>
    `
  }

  renderEmptyMessage () {
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
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
}

customElements.define('ctzn-notifications', CtznNotifications)
