import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import PullToRefresh from '../../vendor/pulltorefreshjs/index.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import './post.js'

const CHECK_NEW_ITEMS_INTERVAL = 15e3
let _cache = {
  path: undefined,
  results: undefined
}

export class Feed extends LitElement {
  static get properties () {
    return {
      source: {type: String},
      pathQuery: {type: Array},
      showDateTitles: {type: Boolean, attribute: 'show-date-titles'},
      dateTitleRange: {type: String, attribute: 'date-title-range'},
      forceRenderMode: {type: String, attribute: 'force-render-mode'},
      recordClass: {type: String, attribute: 'record-class'},
      title: {type: String},
      sort: {type: String},
      limit: {type: Number},
      notifications: {type: Object},
      filter: {type: String},
      results: {type: Array},
      emptyMessage: {type: String, attribute: 'empty-message'},
      noMerge: {type: Boolean, attribute: 'no-merge'},
      hasNewItems: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.showDateTitles = false
    this.dateTitleRange = undefined
    this.forceRenderMode = undefined
    this.recordClass = ''
    this.title = undefined
    this.sort = 'ctime'
    this.limit = 15
    this.filter = undefined
    this.notifications = undefined
    this.results = undefined
    this.emptyMessage = undefined
    this.noMerge = false
    this.hasNewItems = false

    // ui state
    this.loadMoreObserver = undefined
    setInterval(() => this.checkNewItems(), CHECK_NEW_ITEMS_INTERVAL)
    this.ptr = PullToRefresh.init({
      mainElement: 'body',
      onRefresh: () => {
        return this.load()
      }
    })

    // query state
    this.activeQuery = undefined
    this.abortController = undefined
  }

  get isLoading () {
    return !this.results || !!this.activeQuery
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (this.activeQuery) {
      return this.activeQuery
    }
    if (!session.isActive()) {
      session.onChange(() => this.load({clearCurrent}), {once: true})
    }
    if (clearCurrent) {
      this.results = undefined
    } else if (_cache.path === window.location.pathname) {
      // use cached results
      this.results = _cache.results
      /* dont await */ this.queueQuery() // queue up a load to make sure we're getting latest
      return
    }
    return this.queueQuery()
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    PullToRefresh.destroyAll()
  }

  updated (changedProperties) {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.load()
      }
    } else if (changedProperties.has('source') && this.source !== changedProperties.get('source')) {
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
    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    let results = more ? (this.results || []) : []
    let lt = more ? results[results?.length - 1]?.key : undefined
    if (this.source) {
      results = results.concat(await session.ctzn.listUserFeed(this.source, {limit: this.limit, reverse: true, lt}))
    } else {
      results = results.concat((await session.ctzn.view('ctzn.network/feed-view', {limit: this.limit, reverse: true, lt}))?.feed)
    }
    console.log(results)

    if (!more && _cache?.path === window.location.pathname && _cache?.results?.[0]?.url === results[0]?.url) {
      // stick with the cache but update the signal metrics
      for (let i = 0; i < results.length; i++) {
        this.results[i].reactions = _cache.results[i].reactions = results[i].reactions
        this.results[i].replyCount = _cache.results[i].replyCount = results[i].replyCount
      }
      this.requestResultUpdates()
    } else {
      this.results = results
      _cache = {path: window.location.pathname, results}
    }

    this.activeQuery = undefined
    this.hasNewItems = false
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  async checkNewItems () {
    if (!this.results) {
      return
    }
    let results
    if (this.source) {
      results = await session.ctzn.listUserFeed(this.source, {limit: 1, reverse: true})
    } else {
      results = (await session.ctzn.view('ctzn.network/feed-view', {limit: 1, reverse: true}))?.feed
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
    let postEls = this.querySelectorAll('ctzn-post')
    for (let el of Array.from(postEls)) {
      el.requestUpdate()
    }
  }

  // rendering
  // =

  render () {
    if (!this.results) {
      return html`
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        <div class="bg-gray-50 text-gray-500 py-44 text-center my-5">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.results.length) {
      if (!this.emptyMessage) return html``
      return html`
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        ${this.renderHasNewItems()}
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <div>${this.emptyMessage}</div>
        </div>
      `
    }
    return html`
      ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
      ${this.renderHasNewItems()}
      ${this.renderResults()}
      ${this.results?.length ? html`<div class="bottom-of-feed mb-10"></div>` : ''}
    `
  }

  renderHasNewItems () {
    if (!this.hasNewItems) {
      return ''
    }
    return html`
      <div
        class="new-items-indicator bg-blue-50 border border-blue-500 cursor-pointer fixed font-semibold hover:bg-blue-100 inline-block px-4 py-2 rounded-3xl shadow-md text-blue-800 text-sm z-30"
        @click=${this.onClickViewNewPosts}
      >
        New Posts <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderResults () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    if (!this.filter) {
      return html`
        ${repeat(this.results, result => result.url, result => html`
          ${this.renderDateTitle(result)}
          ${this.renderNormalResult(result)}
        `)}
      `
    }
    return html`
      ${repeat(this.results, result => result.url, result => this.renderSearchResult(result))}
    `
  }

  renderDateTitle (result) {
    if (!this.showDateTitles) return ''
    var resultNiceDate = dateHeader(result.ctime, this.dateTitleRange)
    if (this.lastResultNiceDate === resultNiceDate) return ''
    this.lastResultNiceDate = resultNiceDate
    return html`
      <h2 class="results-header"><span>${resultNiceDate}</span></h2>
    `
  }
  
  renderNormalResult (post) {
    return html`
      <div
        class="grid grid-post px-1 py-0.5 border-b border-gray-200 bg-white sm:my-3 sm:p-0 sm:border-0 sm:bg-transparent"
        style="content-visibility: auto; contain-intrinsic-size: 640px 120px;"
      >
        <div class="pl-2 pt-2 sm:p-0">
          <a class="block" href="/${post.author.userId}" title=${post.author.displayName}>
            <img class="block object-cover rounded-full mt-1 w-10 h-10 sm:w-11 sm:h-11" src=${AVATAR_URL(post.author.userId)}>
          </a>
        </div>
        <ctzn-post
          class="block sm:border border-gray-200 rounded-md bg-white min-w-0"
          .post=${post}
        ></ctzn-post>
      </div>
    `
  }

  renderSearchResult (result) {
    // TODO
  }

  // events
  // =

  onClickViewNewPosts (e) {
    this.hasNewItems = false
    this.load()
    window.scrollTo(0, 0)
  }
}

customElements.define('ctzn-feed', Feed)

const HOUR = 1e3 * 60 * 60
const DAY = HOUR * 24
function dateHeader (ts, range) {
  const endOfTodayMs = +((new Date).setHours(23,59,59,999))
  var diff = endOfTodayMs - ts
  if (diff < DAY) return 'Today'
  if (diff < DAY * 6) return (new Date(ts)).toLocaleDateString('default', { weekday: 'long' })
  if (range === 'month') return (new Date(ts)).toLocaleDateString('default', { month: 'short', year: 'numeric' })
  return (new Date(ts)).toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })
}