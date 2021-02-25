import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { listUserFeed } from '../lib/getters.js'
import { emit } from '../lib/dom.js'
import './post.js'

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
      noMerge: {type: Boolean, attribute: 'no-merge'}
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

    // ui state
    this.loadMoreObserver = undefined

    // query state
    this.activeQuery = undefined
    this.abortController = undefined
  }

  get isLoading () {
    return !this.results || !!this.activeQuery
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!session.isActive()) {
      session.onChange(() => this.load({clearCurrent}), {once: true})
    }
    if (clearCurrent) this.results = undefined
    this.queueQuery()
  }

  updated (changedProperties) {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.queueQuery()
      }
    }
    if (changedProperties.has('filter') && changedProperties.get('filter') != this.filter) {
      this.queueQuery()
    } else if (changedProperties.has('pathQuery') && changedProperties.get('pathQuery') != this.pathQuery) {
      // NOTE ^ to correctly track this, the query arrays must be reused
      this.results = undefined // clear results while loading
      this.queueQuery()
    } else if (changedProperties.has('source') && !isArrayEq(this.source, changedProperties.get('source'))) {
      this.queueQuery()
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
      if (more) return
      if (this.abortController) this.abortController.abort()
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery({more})
      })
    }
  }

  async query ({more} = {more: false}) {
    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    let results = more ? this.results : []
    let lt = more ? results[results?.length - 1]?.key : undefined
    if (this.source) {
      results = results.concat(await listUserFeed(this.source, {limit: this.limit, reverse: true, lt}))
    } else {
      results = results.concat(await session.api.posts.listHomeFeed({limit: this.limit, reverse: true, lt}))
    }
    console.log(results)
    this.results = results
    this.activeQuery = undefined
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
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
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <div>${this.emptyMessage}</div>
        </div>
      `
    }
    return html`
      ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
      ${this.renderResults()}
      ${this.results?.length ? html`<div class="bottom-of-feed mb-10"></div>` : ''}
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
      <div class="grid grid-post my-2 px-1 border-t border-b border-gray-200 bg-white sm:my-3 sm:px-0 sm:border-0 sm:bg-transparent">
        <a class="block pl-2 pt-2 sm:p-0" href="/${post.author.userId}" title=${post.author.displayName}>
          <img class="block object-cover rounded-full mt-1 w-8 h-8 sm:w-11 sm:h-11" src=${AVATAR_URL(post.author.userId)}>
        </a>
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
}

customElements.define('ctzn-feed', Feed)

function isArrayEq (a, b) {
  if (!a && !!b) return false
  if (!!a && !b) return false
  return a.sort().toString() == b.sort().toString() 
}

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

function reduceMultipleActions (acc, result) {
  acc.push(result)
  return acc

  // TODO
  let last = acc[acc.length - 1]
  if (last) {
    if (last.site.url === result.site.url && getRecordType(result) === 'subscription' && getRecordType(last) === 'subscription') {
      last.mergedItems = last.mergedItems || []
      last.mergedItems.push(result)
      return acc
    }
  }
  acc.push(result)
  return acc
}