import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as toast from '../com/toast.js'
import * as session from '../lib/session.js'
import { ComposerPopup } from '../com/popups/composer.js'
import '../com/header.js'
import '../com/button.js'
import '../com/login.js'
import '../com/feed.js'
import '../com/post-composer.js'
import '../com/activity-feed.js'
import '../com/img-fallbacks.js'
import '../com/suggestions-sidebar.js'

class CtznMainView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      currentView: {type: String},
      searchQuery: {type: String},
      isEmpty: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.searchQuery = ''
    this.isEmpty = false

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
      document.body.classList.add('no-pad')
      return this.requestUpdate()
    }

    if (this.querySelector('ctzn-feed')) {
      this.querySelector('ctzn-feed').load()
    }

    if ((new URL(window.location)).searchParams.has('composer')) {
      await this.requestUpdate()
      document.querySelector('ctzn-composer').focus()
      window.history.replaceState({}, null, '/')
    }
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    const feed = this.querySelector('ctzn-feed')
    feed.pageLoadScrollTo(y)
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
    const navCls = (id) => `
      block text-center pt-2 pb-2.5 px-5 sm:px-7 font-semibold cursor-pointer hover:bg-gray-50 hover:text-blue-600
      ${id === this.currentView ? 'border-b-2 border-blue-600 text-blue-600' : ''}
    `.replace('\n', '')

    return html`
      <ctzn-header @post-created=${e => this.load()}></ctzn-header>
      <main class="col2">
        <div>
          <div
            class="sticky top-0 z-10 flex mb-0.5 sm:mt-0.5 sm:rounded"
            style="
              backdrop-filter: blur(4px);
              -webkit-backdrop-filter: blur(4px);
              background: rgba(255, 255, 255, 0.9);
            "
          >
            <a class="${navCls('feed')}" href="/">Feed</a>
            <a class="${navCls('activity')}" href="/activity">Activity</a>
          </div>
          ${this.currentView === 'feed' ? html`
            ${this.renderMockComposer()}
            ${this.isEmpty ? this.renderEmptyMessage() : ''}
            <ctzn-feed
              limit="50"
              @load-state-updated=${this.onFeedLoadStateUpdated}
              @publish-reply=${this.onPublishReply}
              @delete-post=${this.onDeletePost}
              @moderator-remove-post=${this.onModeratorRemovePost}
            ></ctzn-feed>
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
}

customElements.define('ctzn-main-view', CtznMainView)