import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
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

    // query state
    this.activeQuery = undefined
  }

  get isLoading () {
    return !this.results || !!this.activeQuery
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (!session.isActive()) {
      console.log('not active yet')
      session.onChange(() => this.load({clearCurrent}), {once: true})
      return
    }
    if (clearCurrent) this.results = undefined
    this.queueQuery()
  }

  updated () {
    if (typeof this.results === 'undefined') {
      if (!this.activeQuery) {
        this.load()
      }
    }
  }

  queueQuery () {
    if (!this.activeQuery) {
      this.activeQuery = this.query()
      this.requestUpdate()
    } else {
      this.activeQuery = this.activeQuery.catch(e => undefined).then(r => {
        this.activeQuery = undefined
        this.queueQuery()
      })
    }
  }

  async query () {
    emit(this, 'load-state-updated')
    var results = []
    // because we collapse results, we need to run the query until the limit is fulfilled
    let before = undefined
    do {
      let subresults = await session.api.notifications.list({before})
      if (subresults.length === 0) break
      
      before = subresults[subresults.length - 1].createdAt
      results = results.concat(subresults)
    } while (results.length < this.limit)
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
        <div class="border border-gray-200">
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
      <div class="border border-gray-300 border-b-0">
        ${this.renderResults()}
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
  
  renderNotification (notification) {
    const schemaId = extractSchemaId(notification.itemUrl)
    if (schemaId !== 'ctzn.network/comment' && schemaId !== 'ctzn.network/follow') {
      return ''
    }
    return html`
      <ctzn-notification
        class="block border-b border-gray-300"
        .notification=${notification}
        ?is-unread=${Number(new Date(notification.createdAt)) > this.clearedAt}
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