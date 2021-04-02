import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from '../com/toast.js'
import * as session from '../lib/session.js'
import { ComposerPopup } from '../com/popups/composer.js'
import PullToRefresh from '../../vendor/pulltorefreshjs/index.js'
import '../com/header.js'
import '../com/button.js'
import '../com/login.js'
import '../com/feed.js'
import '../com/notifications-feed.js'
import '../com/post-composer.js'
import '../com/activity-feed.js'
import '../com/img-fallbacks.js'
import '../com/suggestions-sidebar.js'
import '../com/subnav.js'

class CtznMainView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      currentView: {type: String},
      searchQuery: {type: String},
      isEmpty: {type: Boolean},
      numUnreadNotifications: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.searchQuery = ''
    this.isEmpty = false
    this.notificationsClearedAt = undefined
    this.numUnreadNotifications = 0

    const pathParts = (new URL(location)).pathname.split('/')
    this.currentView = pathParts[1] || 'feed'

    this.load()
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      const pathParts = (new URL(location)).pathname.split('/')
      this.currentView = pathParts[1] || 'feed'
      this.load()
    }
  }

  async load () {
    document.title = `CTZN`
    if (!session.isActive()) {
      if (location.pathname !== '/') {
        window.location = '/'
      } else {
        document.body.classList.add('no-pad')
      }
      return this.requestUpdate()
    }

    if (this.currentView === 'notifications') {
      document.title = `Notifications | CTZN`
      const res = await session.ctzn.view('ctzn.network/notifications-cleared-at-view')
      this.notificationsClearedAt = res?.notificationsClearedAt ? Number(new Date(res?.notificationsClearedAt)) : 0

      if (document.hasFocus) {
        await session.api.notifications.updateNotificationsClearedAt()
      }
    }

    if (this.querySelector('ctzn-feed')) {
      this.querySelector('ctzn-feed').load()
    }
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('ctzn-feed') || this.querySelector('ctzn-notifications-feed')
    feed.pageLoadScrollTo(y)
  }

  connectedCallback () {
    super.connectedCallback(
    this.ptr = PullToRefresh.init({
      mainElement: 'body',
      onRefresh: () => {
        if (this.querySelector('ctzn-feed')) {
          this.querySelector('ctzn-feed').load()
        } else if (this.querySelector('ctzn-notifications-feed')) {
          this.querySelector('ctzn-notifications-feed').load()
        } else if (this.querySelector('ctzn-activity-feed')) {
          this.querySelector('ctzn-activity-feed').load()
        }
      }
    }))
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    PullToRefresh.destroyAll()
  }

  // rendering
  // =

  render () {
    return html`
      ${this.renderCurrentView()}
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return this.renderNoSession()
    }
    return this.renderWithSession()
  }

  renderNoSession () {
    return html`
      <div class="bg-gray-700 border-gray-200 fixed py-2 text-center text-gray-100 w-full" style="top: 0; left: 0">
        <span class="font-bold text-gray-50">Alpha Release</span>.
        This is a preview build of CTZN.
      </div>
      <div class="hidden lg:block" style="margin-top: 15vh">
        <div class="flex my-2 max-w-4xl mx-auto">
          <div class="flex-1 py-20 text-gray-800 text-lg">
            <h1 class="font-semibold mb-1 text-6xl tracking-widest">CTZN<span class="font-bold text-3xl text-gray-500 tracking-normal" data-tooltip="Alpha Version">α</span></h1>
            <div class="mb-6 text-gray-500 text-2xl tracking-tight">(Pronounced "Citizen")</div>
            <div class="mb-8 text-2xl">
              Build your community in a decentralized<br>social network.
            </div>
            <div class="mb-6 text-blue-600 hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                <span class="fas fa-external-link-alt fa-fw"></span>
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div class="w-96">
            <ctzn-login class="block border border-gray-300 overflow-hidden rounded-2xl shadow-xl"></ctzn-login>
          </div>
        </div>
      </div>
      <div class="block lg:hidden">
        <div class="max-w-lg mx-auto bg-white sm:border sm:border-gray-300 sm:my-8 sm:rounded-2xl sm:shadow-xl">
          <div class="text-center pt-20 pb-14 text-gray-800 text-lg border-b border-gray-300">
            <h1 class="font-semibold mb-1 text-6xl tracking-widest">CTZN<span class="font-bold text-3xl text-gray-500 tracking-normal">α</span></h1>
            <div class="mb-6 text-gray-500 text-2xl tracking-tight">(Pronounced "Citizen")</div>
            <div class="mb-6 text-xl px-4">
              Build your community in a decentralized social network.
            </div>
            <div class="mb-6 text-blue-600 hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div>
            <ctzn-login></ctzn-login>
          </div>
        </div>
      </div>
    `
  }

  renderWithSession () {
    const SUBNAV_ITEMS = [
      {menu: true, mobileOnly: true, label: html`<span class="fas fa-bars"></span>`},
      {path: '/', label: 'Feed'},
      {
        path: '/notifications',
        mobileOnly: true,
        label: html`
          ${this.numUnreadNotifications > 0 ? html`
            <span class="inline-block text-sm px-2 bg-blue-600 text-white rounded-full">${this.numUnreadNotifications}</span>
          ` : ''}
          Notifications
        `
      },
      {path: '/activity', label: 'Activity'},
    ]
    return html`
      <ctzn-header
        current-path=${this.currentPath}
        @post-created=${e => this.load()}
        @unread-notifications-changed=${this.onUnreadNotificationsChanged}
      ></ctzn-header>
      <main class="col2">
        <div>
          <ctzn-subnav
            nav-cls="mb-0.5 sm:mt-0.5"
            .items=${SUBNAV_ITEMS}
            current-path=${this.currentPath}
          ></ctzn-subnav>
          ${this.currentView === 'feed' ? html`
            ${this.renderMockComposer()}
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <ctzn-feed
              limit="15"
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @publish-reply=${this.onPublishReply}
              @delete-post=${this.onDeletePost}
              @moderator-remove-post=${this.onModeratorRemovePost}
            ></ctzn-feed>
          ` : this.currentView === 'notifications' ? html`
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <ctzn-notifications-feed
              cleared-at=${this.notificationsClearedAt}
              limit="15"
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @publish-reply=${this.onPublishReply}
            ></ctzn-notifications-feed>
          ` : this.currentView === 'activity' ? html`
            <ctzn-activity-feed
              dataview="ctzn.network/dbmethod-feed-view"
              .methodsFilter=${[
                'ctzn.network/create-item-method',
                'ctzn.network/create-item-class-method',
                'ctzn.network/delete-item-class-method',
                'ctzn.network/destroy-item-method',
                'ctzn.network/put-item-class-method',
                'ctzn.network/transfer-item-method',
                'ctzn.network/update-item-class-method'
              ]}
            ></ctzn-activity-feed>
          ` : ''}
        </div>
        ${this.renderRightSidebar()}
      </main>
    `
  }

  renderMockComposer () {
    return html`
      <div class="bg-white mb-0.5 px-3 py-3 sm:rounded" @click=${this.onClickCreatePost}>

        <div class="flex items-center">
          <div
            class="flex-1 mr-1 py-1 px-3 bg-gray-100 text-gray-600 text-base rounded cursor-text"
          >What's new?</div>
          <ctzn-button
            transparent
            btn-class="text-sm px-2 py-1 sm:px-4"
            label="Add Image"
            icon="far fa-image"
            @click=${e => this.onClickCreatePost(e, {intent: 'image'})}
          ></ctzn-button>
        </div>
      </div>
    `
  }

  renderEmptyMessage () {
    if (this.searchQuery) {
      return html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
            <div class="fas fa-search text-6xl text-gray-300 mb-8"></div>
          <div>No results found for "${this.searchQuery}"</div>
        </div>
      `
    }
    if (this.currentView === 'notifications') {
      return html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center border border-t-0 border-gray-200">
          <div class="fas fa-bell text-6xl text-gray-300 mb-8"></div>
          <div>You have no notifications!</div>
        </div>
      `}
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-4">
        <div class="fas fa-stream text-6xl text-gray-300 mb-8"></div>
        <div>Follow people and<br>join communities to see what's new.</div>
      </div>
    `
  }

  renderRightSidebar () {
    return html`
      <nav class="pt-2">
        <ctzn-suggestions-sidebar></ctzn-suggestions-sidebar>
      </nav>
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

  async onClickCreatePost (e, opts = {}) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await ComposerPopup.create({
        community: this.community,
        ...opts
      })
      toast.create('Post published', '', 10e3)
      this.load()
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  async onDeletePost (e) {
    try {
      await session.ctzn.user.table('ctzn.network/post').delete(e.detail.post.key)
      toast.create('Post deleted')
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onModeratorRemovePost (e) {
    try {
      const post = e.detail.post
      await session.ctzn.db(post.value.community.userId).method(
        'ctzn.network/community-remove-content-method',
        {contentUrl: post.url}
      )
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  onUnreadNotificationsChanged (e) {
    this.numUnreadNotifications = e.detail.count
    if (this.currentView === 'notifications') {
      document.title = e.detail.count ? `(${e.detail.count}) Notifications | CTZN` : `Notifications | CTZN`
      this.querySelector('ctzn-notifications-feed').loadNew(e.detail.count)

      if (document.hasFocus()) {
        session.api.notifications.updateNotificationsClearedAt()
      }
    }
  }
}

customElements.define('ctzn-main-view', CtznMainView)