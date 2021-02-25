import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { repeat } from '../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import * as toast from './com/toast.js'
import * as session from './lib/session.js'
import { listMemberships } from './lib/getters.js'
import * as displayNames from './lib/display-names.js'
import './com/header.js'
import './com/button.js'
import './com/login.js'
import './com/feed.js'
import './com/img-fallbacks.js'

const SUGGESTED_COMMUNITIES = [
  {
    userId: 'foo@foo.com',
    displayName: 'Cool community',
    description: 'The coolest community in CTZN.'
  },
  {
    userId: 'foo@foo.com',
    displayName: 'Test data',
    description: 'These suggestions are not real.'
  },
  {
    userId: 'foo@foo.com',
    displayName: 'Test data',
    description: 'We\'ll choose real suggestions during Alpha Launch Saturday!'
  }
]

class CtznApp extends LitElement {
  static get properties () {
    return {
      searchQuery: {type: String},
      isEmpty: {type: Boolean},
      memberships: {type: Array}
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
    this.memberships = undefined
    this.suggestedCommunities = undefined

    this.load()

    window.addEventListener('popstate', (event) => {
      this.configFromQP()
    })
  }

  async load () {
    await session.setup()
    this.isLoading = false
    if (!session.isActive()) {
      document.body.classList.add('no-pad')
      document.body.classList.add('bg-gray-50')
      return this.requestUpdate()
    }
    this.memberships = await listMemberships(session.info.userId)
    if (!this.suggestedCommunities) {
      this.suggestedCommunities = SUGGESTED_COMMUNITIES.filter(c => !this.memberships?.find(m => c.userId === m.value.community.userId))
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

  // rendering
  // =

  render () {
    return html`
      ${this.renderCurrentView()}
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
      <div class="hidden lg:block" style="margin-top: 10vh">
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
    return html`
      <ctzn-header @post-created=${e => this.load()}></ctzn-header>
      <main>
        <div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <ctzn-feed
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
            @delete-post=${this.onDeletePost}
            @moderator-remove-post=${this.onModeratorRemovePost}
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
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-4">
        <div class="fas fa-stream text-6xl text-gray-300 mb-8"></div>
        <div>Follow people and<br>join communities to see what's new.</div>
      </div>
    `
  }

  renderRightSidebar () {
    return html`
      <nav class="pl-1">
        ${''/*todo <section class="mb-4">
          <span class="fas fa-search"></span>
          ${!!this.searchQuery ? html`
            <a class="clear-search" @click=${this.onClickClearSearch}><span class="fas fa-times"></span></a>
          ` : ''}
          <input @keyup=${this.onKeyupSearch} placeholder="Search" value=${this.searchQuery}>
        </section>*/}
        <section class="pt-1 mb-8">
          <h3 class="font-bold mb-2 text-gray-500 text-xs">My Communities</h3>
          ${this.memberships?.length ? html`
            <div class="mt-2">
              ${repeat(this.memberships, membership => html`
                <div>
                  <a class="text-sm hover:pointer hover:underline" href="/${membership.value.community.userId}">${displayNames.render(membership.value.community.userId)}</a>
                </div>
              `)}
            </div>
          ` : html`
            <div>
              Join a community to get connected to more people!
            </div>
          `}
        </section>
        <section class="pt-1 mb-4">
          <h3 class="font-bold mb-2 text-gray-500 text-xs">Suggested Communities</h3>
          ${repeat(this.suggestedCommunities, community => community.userId, community => {
            const hasJoined = this.memberships?.find(m => community.userId === m.value.community.userId)
            return html`
              <div class="text-sm mb-3">
                <div>
                  <a class="text-sm hover:pointer hover:underline" href="/${community.userId}" title=${community.displayName}>
                  ${community.displayName}
                  </a>
                </div>
                <div class="text-gray-600 mb-1">${community.description}</div>
                <div>
                  ${hasJoined ? html`
                    <button
                      class="border border-blue-400 px-4 py-0.5 rounded-2xl text-blue-600 text-sm cursor-default"
                      disabled
                    >Joined!</button>
                  ` : html`
                    <button
                      class="border border-blue-400 hover:bg-gray-100 hover:pointer px-4 py-0.5 rounded-2xl text-blue-600 text-sm"
                      @click=${e => this.onClickJoinSuggestedCommunity(e, community)}
                      ?disabled=${hasJoined}
                    >${community.isJoining ? html`<span class="spinner"></span>` : 'Join'}</button>
                  `}
                </div>
              </div>
            `
          })}
        </section>
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

  onViewThread (e) {
    ViewThreadPopup.create({
      subject: e.detail.subject
    })
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
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

  async onModeratorRemovePost (e) {
    try {
      const post = e.detail.post
      await session.api.communities.removePost(post.value.community.userId, post.url)
      this.load()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onClickJoinSuggestedCommunity (e, community) {
    community.isJoining = true
    this.requestUpdate()
    try {
      await session.api.communities.join(community.userId)
      toast.create('Community joined')
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    community.isJoining = false
    this.requestUpdate()
    this.load()
  }
}

customElements.define('ctzn-app', CtznApp)
