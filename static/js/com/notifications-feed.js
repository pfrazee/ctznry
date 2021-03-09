import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import PullToRefresh from '../../vendor/pulltorefreshjs/index.js'
import { emit } from '../lib/dom.js'
import { extractSchemaId } from '../lib/strings.js'
import * as session from '../lib/session.js'
import './notification.js'

export class NotificationsFeed extends LitElement {
  static get properties () {
    return {
      showDateTitles: {type: Boolean, attribute: 'show-date-titles'},
      dateTitleRange: {type: String, attribute: 'date-title-range'},
      clearedAt: {type: Number, attribute: 'cleared-at'},
      title: {type: String},
      sort: {type: String},
      limit: {type: Number},
      results: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.showDateTitles = false
    this.dateTitleRange = undefined
    this.clearedAt = undefined
    this.title = undefined
    this.sort = 'ctime'
    this.limit = undefined
    this.results = undefined

    // ui state
    this.loadMoreObserver = undefined
    this.ptr = PullToRefresh.init({
      mainElement: 'body',
      onRefresh: () => {
        return this.load()
      }
    })

    // query state
    this.activeQuery = undefined
  }

  get isLoading () {
    return !this.results || !!this.activeQuery
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!session.isActive()) {
      session.onChange(() => this.load({clearCurrent}), {once: true})
      return
    }
    if (clearCurrent) this.results = undefined
    return this.queueQuery()
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    PullToRefresh.destroyAll()
  }

  updated () {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.load()
      }
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
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery()
      })
    }
    return this.activeQuery
  }

  async query ({more} = {more: false}) {
    emit(this, 'load-state-updated')
    let results = more ? (this.results || []) : []

    // because we collapse results, we need to run the query until the limit is fulfilled
    let lt = more ? results[results?.length - 1]?.key : undefined
    do {
      let subresults = await session.api.notifications.list({lt})
      if (subresults.length === 0) break
      
      lt = subresults[subresults.length - 1].key
      results = results.concat(subresults)

      // apply dedup, results may sometimes have duplicates
      results = results.filter((entry, index) => {
        return results.findIndex(entry2 => entry2.itemUrl === entry.itemUrl) === index
      })
    } while (results.length < this.limit)
    
    console.log(results)
    this.results = results
    this.activeQuery = undefined
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  async loadNew (num) {
    if (!this.results) {
      return
    }
    let results = []
    while (num) {
      let subresults = await session.api.notifications.list({limit: num})
      if (!subresults?.length) break
      results = results.concat(subresults)
      num -= subresults.length
    }
    if (results?.length) {
      this.results = results.concat(results)
    }
  }

  async pageLoadScrollTo (y) {
    window.scrollTo(0, y)
    while (true) {
      if (Math.abs(window.scrollY - y) < 100) {
        return
      }

      let numResults = this.results?.length || 0
      await this.queueQuery({more: true})
      window.scrollTo(0, y)
      if (numResults === this.results?.length || 0) {
        return
      }
    }
  }

  // rendering
  // =

  render () {
    if (!this.results) {
      return html`
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        <div class="border border-gray-200 px-6 py-5 text-gray-500">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.results.length) {
      return html``
    }
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
      <div class="border border-gray-300 border-t-0">
        ${this.renderResults()}
        ${this.results?.length ? html`<div class="bottom-of-feed mb-10"></div>` : ''}
      </div>
    `
  }

  renderResults () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    return html`
      ${repeat(this.results, result => result.url, result => html`
        ${this.renderDateTitle(result)}
        ${this.renderNotification(result)}
      `)}
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
  
  renderNotification (note) {
    const schemaId = extractSchemaId(note.itemUrl)
    if (schemaId !== 'ctzn.network/comment' && schemaId !== 'ctzn.network/follow' && schemaId !== 'ctzn.network/reaction') {
      return ''
    }
    let blendedCreatedAt = Number(new Date(note.blendedCreatedAt))
    return html`
      <ctzn-notification
        class="block border-b border-gray-300"
        .notification=${note}
        ?is-unread=${blendedCreatedAt > this.clearedAt}
      ></ctzn-notification>
    `
  }

  // events
  // =
}

customElements.define('ctzn-notifications-feed', NotificationsFeed)

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