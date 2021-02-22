import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { repeat } from '../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import { ComposerPopup } from './com/popups/composer.js'
import { CreateCommunityPopup } from './com/popups/create-community.js'
import * as toast from './com/toast.js'
import { AVATAR_URL } from './lib/const.js'
import * as session from './lib/session.js'
import { listMemberships } from './lib/getters.js'
import './com/header.js'
import './com/button.js'
import './com/feed.js'
import './com/img-fallbacks.js'

class CtznApp extends LitElement {
  static get properties () {
    return {
      searchQuery: {type: String},
      isEmpty: {type: Boolean},
      memberships: {type: Array},
      numNewItems: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isLoading = true
    this.searchQuery = ''
    this.isEmpty = false
    this.numNewItems = 0
    this.loadTime = Date.now()
    this.memberships = undefined

    this.load()

    setInterval(this.checkNewItems.bind(this), 5e3)

    window.addEventListener('popstate', (event) => {
      this.configFromQP()
    })
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    await session.setup()
    this.isLoading = false
    if (!session.isActive()) {
      return this.requestUpdate()
    }
    this.memberships = await listMemberships(session.info.userId)

    if (this.querySelector('ctzn-feed')) {
      this.loadTime = Date.now()
      this.numNewItems = 0
      this.querySelector('ctzn-feed').load({clearCurrent})
    }
    
    if ((new URL(window.location)).searchParams.has('composer')) {
      await this.requestUpdate()
      document.querySelector('ctzn-composer').focus()
      window.history.replaceState({}, null, '/')
    }
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

  // rendering
  // =

  render () {
    return html`
      <ctzn-header></ctzn-header>
      ${this.renderCurrentView()}
    `
  }

  renderRightSidebar () {
    return html`
      <div>
        <div class="sticky top-0 py-4">
          ${''/*todo <section class="mb-4">
            <span class="fas fa-search"></span>
            ${!!this.searchQuery ? html`
              <a class="clear-search" @click=${this.onClickClearSearch}><span class="fas fa-times"></span></a>
            ` : ''}
            <input @keyup=${this.onKeyupSearch} placeholder="Search" value=${this.searchQuery}>
          </section>*/}
          <section class="mb-4">
            <ctzn-button
              primary
              class="text-sm font-semibold w-full mb-1"
              label="Create Post"
              @click=${this.onClickCreatePost}
            ></ctzn-button>
            <ctzn-button
              class="text-gray-600 text-sm font-semibold w-full"
              label="Create Community"
              @click=${this.onClickCreateCommunity}
            ></ctzn-button>
          </section>
          <section class="mb-4">
            <h3 class="mb-1 font-bold text-gray-600">My Communities</h3>
            ${this.memberships?.length ? html`
              <div class="mt-2">
                ${repeat(this.memberships, membership => html`
                  <a href="/${membership.value.community.userId}" data-tooltip=${membership.value.community.userId}>
                    <img class="inline-block rounded-full w-10 h-10 object-cover" src="${AVATAR_URL(membership.value.community.userId)}">
                  </a>
                `)}
              </div>
            ` : html`
              <div class="px-3 py-2 bg-gray-100 text-gray-500 text-xs">
                Join a community to get connected to more people!
              </div>
            `}
          </section>
        </div>
      </div>
    `
  }

  renderCurrentView () {
    if (this.isLoading) {
      return this.renderLoading()
    }
    if (!session.isActive()) {
      return this.renderNoSession()
    }
    return this.renderWithSession()
  }

  renderLoading () {
    return html`
      <div class="max-w-4xl mx-auto">
        <div class="py-32 text-center text-gray-400">
          <span class="spinner h-7 w-7"></span>
        </div>
      </div>
    `
  }

  renderNoSession () {
    return html`
      <div class="max-w-4xl mx-auto">
        <div class="text-center py-20 text-gray-600 text-lg">
          <h1 class="font-semibold mb-4 text-4xl">Welcome to the <strong>CTZN</strong> network</h1>
          <div class="mb-4">A decentralized social network.</div>
          <div>
            <ctzn-button class="py-1" label="Log in" href="/login"></ctzn-button>
            <ctzn-button class="py-1" primary label="Sign up" href="/signup"></ctzn-button>
          </div>
        </div>
      </div>
    `
  }

  renderWithSession () {
    return html`
      <main>
        <div>
          <div class="border border-t-0 border-gray-200 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
            Latest Posts
          </div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          ${''/*TODO<div class="reload-page mx-4 mb-4 rounded cursor-pointer overflow-hidden leading-10 ${this.numNewItems > 0 ? 'expanded' : ''}" @click=${e => this.load()}>
            ${this.numNewItems} new ${pluralize(this.numNewItems, 'update')}
          </div>*/}
          <ctzn-feed
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
            @delete-post=${this.onDeletePost}
          ></ctzn-feed>
        </div>
        ${this.renderRightSidebar()}
      </main>
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
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
        <div class="fas fa-stream text-6xl text-gray-300 mb-8"></div>
        <div>Subscribe to citizens<br>or join communities to see what's new.</div>
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

  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await ComposerPopup.create()
      toast.create('Post published', '', 10e3)
      this.load()
    } catch (e) {
      // ignore
      console.log(e)
    }
  }

  async onClickCreateCommunity (e) {
    e.preventDefault()
    e.stopPropagation()
    const res = await CreateCommunityPopup.create()
    console.log(res)
    window.location = `/${res.userId}`
  }

  async onDeletePost (e) {
    try {
      await session.api.posts.del(e.detail.post.key)
      toast.create('Post deleted')
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }
}

customElements.define('ctzn-app', CtznApp)
