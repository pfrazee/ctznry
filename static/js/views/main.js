import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from '../com/toast.js'
import * as session from '../lib/session.js'
import { ComposerPopup } from '../com/popups/composer.js'
import PullToRefresh from '../../vendor/pulltorefreshjs/index.js'
import '../com/header.js'
import '../com/button.js'
import '../com/login.js'
import '../ctzn-tags/posts-feed.js'
import '../com/notifications-feed.js'
import '../com/post-composer.js'
import '../com/img-fallbacks.js'
import '../com/suggestions-sidebar.js'
import '../com/searchable-user-list.js'
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

    if (this.querySelector('ctzn-posts-feed')) {
      this.querySelector('ctzn-posts-feed').load()
    }
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('ctzn-posts-feed') || this.querySelector('app-notifications-feed')
    feed.pageLoadScrollTo(y)
  }

  connectedCallback () {
    super.connectedCallback(
    this.ptr = PullToRefresh.init({
      mainElement: 'body',
      onRefresh: () => {
        if (this.querySelector('ctzn-posts-feed')) {
          this.querySelector('ctzn-posts-feed').load()
        } else if (this.querySelector('app-notifications-feed')) {
          this.querySelector('app-notifications-feed').load()
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
            <div class="mb-6 text-blue-600 hov:hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                <span class="fas fa-external-link-alt fa-fw"></span>
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div class="w-96">
            <app-login class="block border border-gray-300 overflow-hidden rounded-2xl shadow-xl"></app-login>
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
            <div class="mb-6 text-blue-600 hov:hover:underline">
              <a href="https://github.com/pfrazee/ctzn" title="Learn more about CTZN" target="_blank">
                Learn more about CTZN
              </a>
            </div>
          </div>
          <div>
            <app-login></app-login>
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
      {
        path: '/search',
        mobileOnly: true,
        label: 'Search'
      },
      {
        path: '/follow-only',
        label: 'Follows'
      }
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
            nav-cls="mb-0.5 sm:mt-0.5"
            .items=${SUBNAV_ITEMS}
            current-path=${this.currentPath}
          ></app-subnav>
          ${this.currentView === 'feed' ? html`
            ${this.renderMockComposer()}
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <ctzn-posts-feed
              view="ctzn.network/feed-view"
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @publish-reply=${this.onPublishReply}
            ></ctzn-posts-feed>
          ` : this.currentView === 'notifications' ? html`
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <app-notifications-feed
              cleared-at=${this.notificationsClearedAt}
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @publish-reply=${this.onPublishReply}
            ></app-notifications-feed>
          ` : this.currentView === 'search' ? html`
            <div class="bg-white px-2 py-4">
              <div class="text-sm px-2 pb-3 text-gray-500">
                <span class="fas fa-info mr-1 text-xs"></span>
                Search is limited to your communities and follows.
              </div>
              <app-searchable-user-list></app-searchable-user-list>
            </div>
          ` : this.currentView === 'follow-only' ? html`
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <ctzn-posts-feed
              cleared-at=${this.notificationsClearedAt}
              view="ctzn.network/feed-view"
              follow-only=true
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @publish-reply=${this.onPublishReply}
            ></ctzn-posts-feed>
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
          <app-button
            transparent
            btn-class="text-sm px-2 py-1 sm:px-4"
            label="Add Image"
            icon="far fa-image"
            @click=${e => this.onClickCreatePost(e, {intent: 'image'})}
          ></app-button>
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
        <app-suggestions-sidebar></app-suggestions-sidebar>
      </nav>
    `
  }

  /* DEBUG - you can use this to test custom HTML as needed */
  renderHTMLDebug () {
    const testHtml = `
      <h1>Heading 1</h1>
      <p>Content</p>
      <h2>Heading 2</h2>
      <p>Content</p>
      <h3>Heading 3</h3>
      <p>Content</p>
      <h4>Heading 4</h4>
      <p>Content</p>
      <h5>Heading 5</h5>
      <p>Content</p>
      <h6>Heading 6</h6>
      <p>Content</p>
      <h1>Table</h1>
      <table>
        <tr><td>One</td><td>Two</td><td>Three</td></tr>
        <tr><td>One</td><td>Two</td><td>Three</td></tr>
        <tr><td>One</td><td>Two</td><td>Three</td></tr>
      </table>
      <ul>
        <li>One<ul>
          <li>Two</li>
        </ul>
        <li>Three</li>
        <li>Four</li>
      </ul>
      <ol>
        <li>One<ol>
          <li>Two</li>
        </ol>
        <li>Three</li>
        <li>Four</li>
      </ol>
      <blockquote>
        <p>This is a fancy quote</p>
      </blockquote>
      <pre>this is some
pre text</pre>
      <p>This is <code>code</code> and a <kbd>shift+s</kbd></p>
      <p>And <strong>bold</strong> <i>italic</i> <u>underline</u> and <del>strike</del></p>
      <a href="https://example.com">Link outside containing element</a>
      <p>A <a href="https://example.com">Link</a></p>
      <dl>
        <dt>One</dt><dd>Definition</dd>
        <dt>One</dt><dd>Definition</dd>
        <dt>One</dt><dd>Definition</dd>
      </dl>
      <h1>Code</h1>
      <ctzn-code>This is some
custom code</ctzn-code>
      <h1>Post</h1>
      <ctzn-post-view src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
      <h1>Post expanded</h1>
      <ctzn-post-view mode="expanded" src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
      <h1>Post content-only</h1>
      <ctzn-post-view mode="content-only" src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
      <h1>Comment</h1>
      <ctzn-comment-view src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/comment/ff080bc63c67dac0"></ctzn-comment-view>
      <h1>Comment content-only</h1>
      <ctzn-comment-view mode="content-only" src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/comment/ff080bc63c67dac0"></ctzn-comment-view>
      <h1>Iframe</h1>
      <ctzn-iframe src="https://example.com"></ctzn-iframe>
      <h1>Card</h1>
      <ctzn-card>
        <h1>This is inside a card</h1>
        <p>Looks good.</p>
        <ctzn-post-view src="http://localhost:4000/pfrazee@dev1.localhost/ctzn.network/post/ff080bc59b95a9d0"></ctzn-post-view>
        <ctzn-iframe src="https://example.com"></ctzn-iframe>
        <ctzn-code>This is some
  custom code</ctzn-code>
      </ctzn-card>
      <h1>Posts feed</h1>
      <ctzn-posts-feed limit="3"></ctzn-posts-feed>
      <h1>ctzn-followers-list</h1>
      <ctzn-followers-list></ctzn-followers-list>
      <h1>ctzn-following-list</h1>
      <ctzn-following-list></ctzn-following-list>
      <h1>ctzn-community-memberships-list</h1>
      <ctzn-community-memberships-list></ctzn-community-memberships-list>
      <h1>ctzn-community-members-list</h1>
      <ctzn-community-members-list user-id="invite-only@dev1.localhost"></ctzn-community-members-list>
      <h1>ctzn-dbmethods-feed</h1>
      <ctzn-dbmethods-feed limit="3"></ctzn-dbmethods-feed>
      <h1>ctzn-owned-items-list</h1>
      <ctzn-owned-items-list></ctzn-owned-items-list>
      <h1>ctzn-item-classes-list</h1>
      <ctzn-item-classes-list user-id="invite-only@dev1.localhost"></ctzn-item-classes-list>
      <h1>ctzn-comments-feed</h1>
      <ctzn-comments-feed limit="3"></ctzn-comments-feed>
    `

    const post = {
      key: '',
      author: {userId: session.info.userId, displayName: session.info.displayName},
      value: {
        text: 'Debug',
        extendedText: testHtml,
        extendedTextMimeType: 'text/html',
        createdAt: (new Date()).toISOString()
      }
    }
    return html`
      <h1 class="font-bold mb-1">Profile Context</h1>
      <app-custom-html
        context="profile"
        .contextState=${{page: {userId: session.info.userId}}}
        .html=${testHtml}
      ></app-custom-html>
      <h1 class="font-bold mb-1">Post Context</h1>
      <div class="bg-white">
        <ctzn-post-view
          .post=${post}
          mode="expanded"
          .renderOpts=${{noclick: true, preview: true}}
        ></ctzn-post-view>
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

  onUnreadNotificationsChanged (e) {
    this.numUnreadNotifications = e.detail.count
    if (this.currentView === 'notifications') {
      document.title = e.detail.count ? `(${e.detail.count}) Notifications | CTZN` : `Notifications | CTZN`
      this.querySelector('app-notifications-feed').loadNew(e.detail.count)

      if (document.hasFocus()) {
        session.api.notifications.updateNotificationsClearedAt()
      }
    }
  }
}

customElements.define('app-main-view', CtznMainView)