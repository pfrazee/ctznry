import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { emit } from '../lib/dom.js'
import { extractSchemaId } from '../lib/strings.js'
import * as session from '../lib/session.js'
import './notification.js'

let _cache = undefined

export class NotificationsFeed extends LitElement {
  static get properties () {
    return {
      showDateTitles: {type: Boolean, attribute: 'show-date-titles'},
      dateTitleRange: {type: String, attribute: 'date-title-range'},
      clearedAt: {type: Number, attribute: 'cleared-at'},
      title: {type: String},
      sort: {type: String},
      limit: {type: Number},
      results: {type: Array},
      isLoadingMore: {type: Boolean}
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
    this.isLoadingMore = false

    // ui state
    this.loadMoreObserver = undefined

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
    if (clearCurrent) {
      this.results = undefined
    } else if (_cache) {
      // use cached results
      this.results = _cache
      /* dont await */ this.queueQuery() // queue up a load to make sure we're getting latest
      return
    }
    return this.queueQuery()
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
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
    this.isLoadingMore = more

    // because we collapse results, we need to run the query until the limit is fulfilled
    // let lt = more ? results[results?.length - 1]?.key : undefined
    let lt = undefined
    if (more && results?.length) {
      let last = results[results.length - 1]
      if (last.mergedNotes) {
        last = last.mergedNotes[last.mergedNotes.length - 1]
      }
      lt = last.key
    }
    do {
      let subresults = (await session.ctzn.view('ctzn.network/notifications-view', {lt}))?.notifications
      if (subresults.length === 0) break
      
      lt = subresults[subresults.length - 1].key
      results = results.concat(subresults)

      // apply dedup, results may sometimes have duplicates
      results = results.filter((entry, index) => {
        return results.findIndex(entry2 => entry2.itemUrl === entry.itemUrl) === index
      })

      // group together notifications
      results = results.reduce(reduceSimilarNotifications, [])
    } while (results.length < this.limit)

    console.log(results)
    if (more || _cache?.[0].itemUrl !== results[0]?.itemUrl) {
      this.results = results
      _cache = results
    }
    if (!results?.length && !this.results) {
      this.results = []
    }
    this.isLoadingMore = false
    this.activeQuery = undefined
    emit(this, 'load-state-updated', {detail: {isEmpty: this.results.length === 0}})
  }

  async loadNew (num) {
    if (!this.results) {
      return
    }
    let results = []
    while (num) {
      let subresults = (await session.ctzn.view('ctzn.network/notifications-view', {limit: num}))?.notifications
      if (!subresults?.length) break

      let n = subresults.length
      subresults = subresults.filter(r => r.itemUrl !== this.results?.[0]?.itemUrl)
      results = results.concat(subresults)
      if (n > subresults.length) break // ran into an item we already have

      num -= subresults.length
    }
    if (results?.length) {
      this.results = results.concat(results)
    }
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

  // rendering
  // =

  render () {
    if (!this.results) {
      return html`
        ${this.title ? html`<h2  class="results-header"><span>${this.title}</span></h2>` : ''}
        <div class="px-6 py-5 text-gray-500">
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
      ${this.renderResults()}
      ${this.results?.length ? html`
        <div class="bottom-of-feed ${this.isLoadingMore ? 'bg-white' : ''} mb-10 py-4 sm:rounded text-center">
          ${this.isLoadingMore ? html`<span class="spinner w-6 h-6 text-gray-500"></span>` : ''}
        </div>
      ` : ''}
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
      <app-notification
        class="block bg-white mb-0.5 sm:rounded"
        style="content-visibility: auto; contain-intrinsic-size: 640px 120px;"
        .notification=${note}
        ?is-unread=${blendedCreatedAt > this.clearedAt}
      ></app-notification>
    `
  }

  // events
  // =
}

customElements.define('app-notifications-feed', NotificationsFeed)

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

function reduceSimilarNotifications (acc, note) {
  if (note.item?.reaction && note.item?.subject?.dbUrl) {
    const {dbUrl} = note.item.subject
    // is a reaction
    for (let note2 of acc) {
      if (!note2.item?.reaction) continue
      if (note2.item?.subject?.dbUrl === dbUrl) {
        note2.mergedNotes = note2.mergedNotes || []
        note2.mergedNotes.push(note)
        return acc
      }
    }
  }
  acc.push(note)
  return acc
}