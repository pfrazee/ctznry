import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import './post-view.js'

const CHECK_NEW_ITEMS_INTERVAL = 15e3
let _cache = {
  id: undefined,
  results: undefined
}

export class PostsFeed extends LitElement {
  static get properties () {
    return {
      _view: {type: String, attribute: 'view'},
      userId: {type: String, attribute: 'user-id'},
      limit: {type: Number},
      results: {type: Array},
      hasNewItems: {type: Boolean},
      isLoadingMore: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this._view = undefined
    this.userId = undefined
    this.limit = undefined
    this.results = undefined
    this.hasNewItems = false
    this.isLoadingMore = false

    // ui state
    this.loadMoreObserver = undefined
    setInterval(() => this.checkNewItems(), CHECK_NEW_ITEMS_INTERVAL)

    // query state
    this.activeQuery = undefined
    this.abortController = undefined
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    if (this.loadMoreObserver) {
      this.loadMoreObserver.disconnect()
    }
  }

  get view () {
    if (this._view === 'posts') return 'ctzn.network/posts-view'
    if (this._view === 'feed') return 'ctzn.network/feed-view'
    return this._view || 'ctzn.network/posts-view'
  }

  set view (v) {
    this._view = v
  }

  get isLoading () {
    return !!this.activeQuery
  }

  get hasHitLimit () {
    return (this.limit > 0 && this.results?.length >= this.limit)
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  get cacheId () {
    return `${this.userId}|${this.limit}|${this.view}`
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!this.view || (this.view === 'ctzn.network/posts-view' && !this.userId)) {
      return
    }
    if (this.activeQuery) {
      return this.activeQuery
    }
    if (!session.isActive()) {
      session.onChange(() => this.load({clearCurrent}), {once: true})
    }
    if (clearCurrent) {
      this.results = undefined
    } else if (_cache.id === this.cacheId) {
      // use cached results
      this.results = _cache.results
      /* dont await */ this.queueQuery() // queue up a load to make sure we're getting latest
      return
    }
    return this.queueQuery()
  }

  updated (changedProperties) {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.load()
      }
    } else if (changedProperties.has('_view') || changedProperties.has('userId')) {
      this.load()
    }

    const botOfFeedEl = this.querySelector('.bottom-of-feed')
    if (!this.loadMoreObserver && botOfFeedEl) {
      this.loadMoreObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          this.queueQuery({more: true})
        }
      }, {threshold: 1.0})
      this.loadMoreObserver.observe(botOfFeedEl)
    }
  }

  queueQuery ({more} = {more: false}) {
    if (!this.activeQuery) {
      this.activeQuery = this.query({more})
      this.requestUpdate()
    } else {
      if (more) return this.activeQuery
      if (this.abortController) this.abortController.abort()
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery({more})
      })
    }
    return this.activeQuery
  }

  async query ({more} = {more: false}) {
    if (this.hasHitLimit) {
      return
    }

    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    this.isLoadingMore = more

    let results = more ? (this.results || []) : []
    let lt = more ? results[results?.length - 1]?.key : undefined
    if (this.view === 'ctzn.network/feed-view') {
      results = results.concat((await session.ctzn.view(this.view, {limit: 15, reverse: true, lt}))?.feed)
    } else {
      results = results.concat((await session.ctzn.viewByHomeServer(this.userId, this.view, this.userId, {limit: 15, reverse: true, lt}))?.posts)
    }
    if (this.limit > 0 && results.length > this.limit) {
      results = results.slice(0, this.limit)
    }
    console.log(results)

    if (!more && this.results?.length && _cache?.id === this.cacheId && _cache?.results?.[0]?.url === results[0]?.url) {
      // stick with the cache but update the signal metrics
      for (let i = 0; i < results.length && i < this.results.length; i++) {
        this.results[i].reactions = _cache.results[i].reactions = results[i].reactions
        this.results[i].replyCount = _cache.results[i].replyCount = results[i].replyCount
      }
      this.requestResultUpdates()
    } else {
      this.results = results
      _cache = {id: this.cacheId, results}
    }

    this.activeQuery = undefined
    this.hasNewItems = false
    this.isLoadingMore = false
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  async checkNewItems () {
    if (!this.results || this.hasHitLimit) {
      return
    }
    let results
    if (this.view === 'ctzn.network/feed-view') {
      results = (await session.ctzn.view(this.view, {limit: 1, reverse: true}))?.feed
    } else {
      results = (await session.ctzn.viewByHomeServer(this.userId, this.view, this.userId, {limit: 1, reverse: true}))?.posts
    }
    this.hasNewItems = (results[0] && results[0].key !== this.results[0].key)
  }

  async pageLoadScrollTo (y) {
    window.scrollTo(0, y)
    let first = true
    while (true) {
      if (Math.abs(window.scrollY - y) < 10) {
        break
      }

      let numResults = this.results?.length || 0
      if (first) {
        await this.load()
        first = false
      } else {
        await this.queueQuery({more: true})
      }
      await this.requestUpdate()
      window.scrollTo(0, y)
      if (numResults === this.results?.length || 0) {
        break
      }
    }

    setTimeout(() => {
      if (Math.abs(window.scrollY - y) > 10) {
        window.scrollTo(0, y)
      }
    }, 500)
  }

  requestResultUpdates () {
    let postEls = this.querySelectorAll('ctzn-post-view')
    for (let el of Array.from(postEls)) {
      el.requestUpdate()
    }
  }

  // rendering
  // =

  render () {
    if (!this.results) {
      if (!this.isLoading) {
        return ''
      }
      return html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center mb-5">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.results.length) {
      return html`
        ${this.renderHasNewItems()}
        <div class="bg-gray-100 text-gray-500 py-44 text-center">
          <div class="fas fa-stream text-6xl text-gray-300 mb-8"></div>
          ${this.view === 'ctzn.network/posts-view' ? html`
            <div>This feed is empty.</div>
          ` : html`
            <div>Follow people and<br>join communities to see what's new.</div>
          `}
        </div>
      `
    }
    return html`
      ${this.renderHasNewItems()}
      ${this.renderResults()}
      ${this.results?.length && !this.hasHitLimit ? html`
        <div class="bottom-of-feed ${this.isLoadingMore ? 'bg-white' : ''} mb-10 py-4 sm:rounded text-center">
          ${this.isLoadingMore ? html`<span class="spinner w-6 h-6 text-gray-500"></span>` : ''}
        </div>
      ` : ''}
    `
  }

  renderHasNewItems () {
    if (!this.hasNewItems) {
      return ''
    }
    return html`
      <div
        class="new-items-indicator bg-blue-50 border border-blue-500 cursor-pointer fixed font-semibold hov:hover:bg-blue-100 inline-block px-4 py-2 rounded-3xl shadow-md text-blue-800 text-sm z-30"
        @click=${this.onClickViewNewPosts}
      >
        New Posts <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderResults () {
    return html`
      ${repeat(this.results, result => result.url, result => this.renderResult(result))}
    `
  }
  
  renderResult (post) {
    return html`
      <div style="contain-intrinsic-size: 640px 120px;">
        <ctzn-post-view
          .post=${post}
          mode="default"
        ></ctzn-post-view>
      </div>
    `
  }

  // events
  // =

  onClickViewNewPosts (e) {
    this.hasNewItems = false
    this.load()
    window.scrollTo(0, 0)
  }
}

customElements.define('ctzn-posts-feed', PostsFeed)