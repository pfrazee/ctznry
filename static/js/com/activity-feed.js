import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { asyncReplace } from '../../vendor/lit-element/lit-html/directives/async-replace.js'
import PullToRefresh from '../../vendor/pulltorefreshjs/index.js'
import { ViewActivityPopup } from './popups/view-activity.js'
import * as displayNames from '../lib/display-names.js'
import { ITEM_CLASS_ICON_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { extractSchemaId } from '../lib/strings.js'
import './post.js'

const CHECK_NEW_ITEMS_INTERVAL = 15e3
const _itemCache = {}

const METHOD_COLORS = {
  'ctzn.network/create-item-method': 'green-900',
  'ctzn.network/create-item-class-method': 'green-900',
  'ctzn.network/transfer-item-method': 'blue-900',
  'ctzn.network/community-remove-member-method': 'red-900',
  'ctzn.network/community-put-ban-method': 'red-900',
  'ctzn.network/delete-item-class-method': 'red-900',
  'ctzn.network/destroy-item-method': 'red-900',
}
const METHOD_BGS = {
  'ctzn.network/create-item-method': 'green-400',
  'ctzn.network/create-item-class-method': 'green-400',
  'ctzn.network/transfer-item-method': 'blue-400',
  'ctzn.network/community-remove-member-method': 'red-400',
  'ctzn.network/community-put-ban-method': 'red-400',
  'ctzn.network/delete-item-class-method': 'red-400',
  'ctzn.network/destroy-item-method': 'red-400',
}
const METHOD_ICONS = {
  'ctzn.network/community-delete-ban-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-check absolute" style="right: 6px; bottom: 0px; font-size: 11px;"></span>
  `,
  'ctzn.network/community-remove-member-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-ban absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/community-put-ban-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 3px; font-size: 13px;"></span>
    <span class="fas fa-ban absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/create-item-method': html`
    <span class="far fa-gem absolute" style="left: 9px; top: 6px; font-size: 13px;"></span>
    <span class="fas fa-plus absolute" style="right: 9px; bottom: 0px; font-size: 11px"></span>
  `,
  'ctzn.network/create-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0px; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
  'ctzn.network/delete-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0x; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
  'ctzn.network/destroy-item-method': html`
    <span class="far fa-gem absolute" style="left: 9px; top: 5px; font-size: 13px;"></span>
    <span class="fas fa-times absolute" style="right: 9px; bottom: 1px; font-size: 11px"></span>
  `,
  'ctzn.network/put-avatar-method': html`
    <span class="far fa-image absolute" style="left: 10px; top: 2px; font-size: 16px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/put-blob-method': html`
    <span class="far fa-image absolute" style="left: 10px; top: 2px; font-size: 16px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/put-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0px; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
  'ctzn.network/put-profile-method': html`
    <span class="fas fa-user absolute" style="left: 11px; top: 4px; font-size: 13px;"></span>
    <span class="fas fa-pen absolute" style="right: 7px; bottom: 1px; font-size: 11px;"></span>
  `,
  'ctzn.network/transfer-item-method': html`
    <span class="far fa-gem absolute" style="left: 9px; top: 6px; font-size: 13px;"></span>
    <span class="fas fa-arrow-right absolute" style="right: 9px; bottom: 0px; font-size: 11px"></span>
  `,
  'ctzn.network/update-item-class-method': html`
    <span class="absolute" style="left: 8px; top: 0px; font-size: 16px;">
      {<span class="far fa-gem" style="font-size: 12px"></span>}
    </span>
  `,
}

export class ActivityFeed extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      dataview: {type: String},
      methodsFilter: {type: Array},
      entries: {type: Array},
      emptyMessage: {type: String, attribute: 'empty-message'},
      hasNewEntries: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.dataview = undefined
    this.methodsFilter = undefined
    this.entries = undefined
    this.emptyMessage = undefined
    this.hasNewEntries = false

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
  }

  get isLoading () {
    return !this.entries || !!this.activeQuery
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    if (this.activeQuery) {
      return this.activeQuery
    }
    if (clearCurrent) {
      this.entries = undefined
    }
    return this.queueQuery()
  }

  disconnectedCallback (...args) {
    super.disconnectedCallback(...args)
    PullToRefresh.destroyAll()
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
    if (changedProperties.has('dataview') && this.dataview !== changedProperties.get('dataview')) {
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
    if ((!this.userId || !this.dataview) && this.dataview !== 'ctzn.network/dbmethod-feed-view') {
      return
    }

    emit(this, 'load-state-updated')
    this.abortController = new AbortController()
    let entries = more ? (this.entries || []) : []
    let lt = more ? entries[entries?.length - 1]?.key : undefined
    
    const viewRes = (this.dataview === 'ctzn.network/dbmethod-feed-view')
      ? await session.ctzn.view(this.dataview, {limit: 25, lt})
      : await session.ctzn.view(this.dataview, this.userId, {limit: 25, reverse: true, lt})
    let newEntries
    if (viewRes.results) {
      newEntries = viewRes.results.map(resultToGeneric)
    } else if (viewRes.calls) {
      newEntries = viewRes.calls.map(entry => callToGeneric(this.userId, entry))
    } else if (viewRes.feed) {
      newEntries = viewRes.feed.map(feedToGeneric)
    }

    if (this.methodsFilter) {
      newEntries = newEntries.filter(entry => this.methodsFilter.includes(entry.call.method))
    }

    entries = entries.concat(newEntries)
    console.log(entries)
    this.entries = entries
    this.activeQuery = undefined
    this.hasNewEntries = false
    emit(this, 'load-state-updated', {detail: {isEmpty: this.entries.length === 0}})
  }

  async checkNewItems () {
    if (!this.entries) {
      return
    }
    const viewRes = (this.dataview === 'ctzn.network/dbmethod-feed-view')
      ? await session.ctzn.view(this.dataview, {limit: 1})
      : await session.ctzn.view(this.dataview, this.userId, {limit: 1, reverse: true})
    let entries = viewRes.calls || viewRes.results || viewRes.feed
    if (this.methodsFilter) {
      entries = entries.filter(entry => this.methodsFilter.includes(entry.call.method))
    }
    this.hasNewEntries = (entries?.[0] && entries[0].key !== this.entries[0]?.key)
  }

  async pageLoadScrollTo (y) {
    window.scrollTo(0, y)
    let first = true
    while (true) {
      if (Math.abs(window.scrollY - y) < 10) {
        break
      }

      let numResults = this.entries?.length || 0
      if (first) {
        await this.load()
        first = false
      } else {
        await this.queueQuery({more: true})
      }
      await this.requestUpdate()
      window.scrollTo(0, y)
      if (numResults === this.entries?.length || 0) {
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
    if (!this.entries) {
      return html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <span class="spinner"></span>
        </div>
      `
    }
    if (!this.entries.length) {
      if (!this.emptyMessage) return html``
      return html`
        ${this.renderHasNewEntries()}
        <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
          <div>${this.emptyMessage}</div>
        </div>
      `
    }
    return html`
      ${this.renderHasNewEntries()}
      ${this.renderEntries()}
      ${this.entries?.length ? html`<div class="bottom-of-feed mb-10"></div>` : ''}
    `
  }

  renderHasNewEntries () {
    if (!this.hasNewEntries) {
      return ''
    }
    return html`
      <div
        class="new-items-indicator bg-blue-50 border border-blue-500 cursor-pointer fixed font-semibold hover:bg-blue-100 inline-block px-4 py-2 rounded-3xl shadow-md text-blue-800 text-sm z-30"
        @click=${this.onClickViewNewEntries}
      >
        New Activity <span class="fas fa-fw fa-angle-up"></span>
      </div>
    `
  }

  renderEntries () {
    this.lastResultNiceDate = undefined // used by renderDateTitle
    return html`
      ${repeat(this.entries, entry => entry.key, entry => html`
        ${this.renderEntry(entry)}
      `)}
    `
  }
  
  renderEntry (entry) {
    if (entry.result.code !== 'success') return ''
    let [domain, methodName] = entry.call.method.split('/')
    methodName = methodName.replace(/(^(.)|[\-](.))/g, (match, _, char1, char2) => (char1 || char2).toUpperCase())
    const renderMethod = this[`render${methodName}`]
    if (!renderMethod) return ''
    const hasSubject = methodName === 'TransferItemMethod' && entry.call.args.relatedTo
    return html`
      <div
        class="flex bg-white px-2 py-3 sm:py-2 sm:rounded mb-0.5 sm:hover:bg-gray-50 cursor-pointer"
        @click=${e => this.onClickActivity(e, entry)}
      >
        <span class="block rounded bg-${METHOD_BGS[entry.call.method] || 'gray-200'} w-10 h-10 pt-1.5 mr-2">
          <span class="block relative rounded w-10 h-6 text-${METHOD_COLORS[entry.call.method] || 'gray-700'}">
            ${METHOD_ICONS[entry.call.method]}
          </span>
        </span>
        <div class="flex-1 min-w-0">
          <div class="${hasSubject ? 'pt-2.5' : 'py-2.5'} leading-tight">
            <span class="font-medium">${displayNames.render(entry.authorId)}</span>
            <span class="text-gray-800">
              ${renderMethod.call(this, entry)}
            </span>
            <span class="text-sm text-gray-600">${relativeDate(entry.result.createdAt)}</span>
            ${hasSubject ? html`<span class="text-sm">for:</span>` : ''}
          </div>
          ${hasSubject ? html`
            <div class="border border-gray-300 mt-2 px-3 reply rounded bg-white sm:hover:bg-gray-50">
              ${asyncReplace(this.renderSubject(entry.call.args.recp.userId, entry.call.args.relatedTo.dbUrl))}
            </div>
          ` : ''}
        </div>
      </div>    `
  }

  renderCommunityDeleteBanMethod (entry) {
    const {bannedUser} = entry.call.args
    return html`
      lifted the ban on <span class="text-black">${displayNames.render(bannedUser.userId)}</span>
    `
  }
  
  renderCommunityRemoveMemberMethod (entry) {
    const {ban, banReason, member} = entry.call.args
    if (ban) {
      return html`
        banned ${member.userId} from <span class="text-black">${displayNames.render(entry.call.database.userId)}</span>
      `
    }
    return html`
      removed ${member.userId} from <span class="text-black">${displayNames.render(entry.call.database.userId)}</span>
    `
  }
    
  renderCommunityPutBanMethod (entry) {
    const {reason, bannedUser} = entry.call.args
    return html`
      banned ${bannedUser.userId} from <span class="text-black">${displayNames.render(entry.call.database.userId)}</span>
    `
  }
    
  renderCreateItemMethod (entry) {
    const {classId, qty, owner} = entry.call.args
    return html`
      created
      <span class="font-semibold text-gray-800 text-sm">
        <img
          src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
          class="relative inline-block w-4 h-4 object-cover"
          style="top: -2px"
        >
        ${qty}
      </span>
      for
      <span class="text-black">${displayNames.render(owner.userId)}</span>
    `
  }
  
  renderCreateItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      created the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }
  
  renderDeleteItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      deleted the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }
  
  renderDestroyItemMethod (entry) {
    const {itemKey, qty} = entry.call.args
    const [classId] = itemKey.split(':')
    return html`
      destroyed
      <span class="font-semibold text-gray-800 text-sm">
        <img
          src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
          class="relative inline-block w-4 h-4 object-cover"
          style="top: -2px"
        >
        ${qty}
      </span>
    `
  }
  
  renderPutAvatarMethod (entry) {
    return html`
      updated <span class="text-black">${displayNames.render(entry.call.database.userId)}'s</span> avatar
    `
  }
  
  renderPutBlobMethod (entry) {
    const {blobName} = entry.call.args.target
    return html`
      updated <span class="text-black">${displayNames.render(entry.call.database.userId)}'s</span> ${blobName} blob
    `
  }
  
  renderPutItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      set up the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }
  
  renderPutProfileMethod (entry) {
    return html`
      updated <span class="text-black">${displayNames.render(entry.call.database.userId)}'s profile</span>
    `
  }
  
  renderTransferItemMethod (entry) {
    const {itemKey, qty, recp} = entry.call.args
    const [classId] = itemKey.split(':')
    return html`
      gave
      <span class="font-semibold text-gray-800 text-sm">
        <img
          src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
          class="relative inline-block w-4 h-4 object-cover"
          style="top: -2px"
        >
        ${qty}
      </span>
      to <span class="font-medium text-black">${displayNames.render(recp.userId)}</span>
    `
  }
  
  renderUpdateItemClassMethod (entry) {
    const {classId} = entry.call.args
    return html`
      updated the item class
      <img
        src=${ITEM_CLASS_ICON_URL(entry.call.database.userId, classId)}
        class="relative inline-block w-4 h-4 object-cover"
        style="top: -2px"
      >
      <span class="text-black">${classId}</span>
    `
  }

  async *renderSubject (authorId, dbUrl) {
    if (!_itemCache[dbUrl]) {
      yield html`Loading...`
    }

    const schemaId = extractSchemaId(dbUrl)
    let record
    if (schemaId === 'ctzn.network/post') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.ctzn.getPost(authorId, dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <ctzn-post
          .post=${record}
          noctrls
        ></ctzn-post>
      `
    } else if (schemaId === 'ctzn.network/comment') {
      record = _itemCache[dbUrl] ? _itemCache[dbUrl] : await session.ctzn.getComment(authorId, dbUrl)
      _itemCache[dbUrl] = record
      yield html`
        <ctzn-post
          .post=${record}
          noctrls
        ></ctzn-post>
      `
    }
  }

  // events
  // =

  onClickViewNewEntries (e) {
    this.hasNewEntries = false
    this.load()
    window.scrollTo(0, 0)
  }

  onClickActivity (e, entry) {
    ViewActivityPopup.create({activity: entry})
  }
}

customElements.define('ctzn-activity-feed', ActivityFeed)

const MINUTE = 1e3 * 60
const HOUR = 1e3 * 60 * 60
const DAY = HOUR * 24

const rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'})
function relativeDate (d) {
  const nowMs = Date.now()
  const endOfTodayMs = +((new Date).setHours(23,59,59,999))
  const dMs = +(new Date(d))
  let diff = nowMs - dMs
  let dayDiff = Math.floor((endOfTodayMs - dMs) / DAY)
  if (diff < (MINUTE * 5)) return 'just now'
  if (diff < HOUR) return rtf.format(Math.ceil(diff / MINUTE * -1), 'minute')
  if (dayDiff < 1) return rtf.format(Math.ceil(diff / HOUR * -1), 'hour')
  if (dayDiff <= 30) return rtf.format(dayDiff * -1, 'day')
  if (dayDiff <= 365) return rtf.format(Math.floor(dayDiff / 30) * -1, 'month')
  return rtf.format(Math.floor(dayDiff / 365) * -1, 'year')
}

function feedToGeneric (feedEntry) {
  return {
    key: feedEntry.key,
    authorId: feedEntry.caller.userId,
    call: feedEntry.call.value,
    result: feedEntry.result.value
  }
}

function callToGeneric (authorId, callEntry) {
  return {
    key: callEntry.key,
    authorId,
    call: callEntry.value,
    result: callEntry.result.value
  }
}

function resultToGeneric (resultEntry) {
  return {
    key: resultEntry.key,
    authorId: resultEntry.value.call.authorId,
    call: resultEntry.call.value,
    result: resultEntry.value
  }
}