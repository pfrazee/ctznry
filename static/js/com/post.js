import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { AVATAR_URL, POST_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify } from '../lib/strings.js'
import * as displayNames from '../lib/display-names.js'

export class Post extends LitElement {
  static get properties () {
    return {
      post: {type: Object},
      context: {type: String},
      searchTerms: {type: String, attribute: 'search-terms'},
      asReplyParent: {type: Boolean, attribute: 'as-reply-parent'},
      asReplyChild: {type: Boolean, attribute: 'as-reply-child'},
      nometa: {type: Boolean},
      nocommunity: {type: Boolean},
      noctrls: {type: Boolean},
      hoverBgColor: {type: String, attribute: 'hover-bg-color'},
      isReplyOpen: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.post = undefined
    this.context = undefined
    this.searchTerms = undefined
    this.isReplyOpen = false
    this.nometa = false
    this.nocommunity = false
    this.noctrls = false
    this.hoverBgColor = 'gray-50'
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get replyCount () {
    if (typeof this.post?.replyCount !== 'undefined') {
      return this.post.replyCount
    }
    if (typeof this.post?.replies !== 'undefined') {
      return this.post.replies.length
    }
    return 0
  }

  get canInteract () {
    if (this.post?.value?.community?.userId) {
      return session.isInCommunity(this.post.value.community.userId)
    }
    return session.isFollowingMe(this.post.author.userId)
  }

  get ctrlTooltip () {
    if (this.canInteract) return undefined
    if (this.post?.value?.community?.userId) {
      return `Only members of ${displayNames.render(this.post.value.community.userId)} can interact with this post`
    }
    return `Only people followed by ${this.post.author.displayName} can interact with this post`
  }

  async reloadSignals () {
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.post) {
      return html``
    }

    let gridCls = 'grid grid-cols-post'
    if (this.noctrls) gridCls = ''

    if (this.post.error) {
      return html`
        <div class="grid ${gridCls}">
          ${this.noctrls ? '' : html`
            <div class="text-xl pl-1 pt-2 text-gray-500">
              <span class="fas fa-fw fa-exclamation-circle"></span>
            </div>
          `}
          <div class="${borderCls} px-4 py-2 min-w-0 bg-gray-50">
            <div class="font-semibold text-gray-600">
              Failed to load post
            </div>
            ${this.post.message ? html`
              <div class="text-gray-500 text-sm">
                ${this.post.message}
              </div>
            ` : ''}
          </div>
        </div>
      `
    }

    return html`
      <div
        class="relative text-gray-600 cursor-pointer hover:bg-${this.hoverBgColor}"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        ${this.context ? html`
          <div class="pt-2 pb-1 pl-6 text-sm text-gray-500 font-bold">
            ${this.context}
          </div>
        ` : ''}
        <div class="px-2.5 pt-4 pb-4 min-w-0">
          <div
            class="whitespace-pre-wrap break-words text-gray-700 pb-1.5 pl-1 pr-2.5"
            style="font-size: 16px; letter-spacing: 0.3px; line-height: 1.3;"
          >${this.renderPostText()}${this.post.value.extendedText
              ? html`<span class="bg-gray-200 ml-1 px-1 rounded text-gray-600 text-xs">more</span>`
              : ''
          }</div>
          ${this.nometa ? '' : html`
            <div class="flex pl-1 pr-2.5 text-gray-500 text-sm items-center">
              ${this.renderRepliesCtrl()}
              <a class="block relative" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                <img class="block w-4 h-4 object-cover rounded-full mr-1" src=${AVATAR_URL(this.post.author.userId)}>
              </a>
              <div class="mr-1 whitespace-nowrap">
                <a class="hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  <span class="text-gray-500 font-medium">${displayNames.render(this.post.author.userId)}</span>
                </a>
              </div>
              <div>
                <a class="text-gray-500 hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
                ${this.post.value.community ? html`
                  <span class="text-gray-500">
                    in
                    <a href="/${this.post.value.community.userId}" class="whitespace-nowrap font-medium hover:underline">
                      ${displayNames.render(this.post.value.community.userId)}
                    </a>
                  </span>
                ` : ''}
              </div>
            </div>
          `}
        </div>
      </div>
    `
  }

  renderRepliesCtrl () {
    let aCls = `inline-block ml-1 mr-3`
    if (this.canInteract) {
      aCls += ` text-gray-500`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${this.onViewThread}>
        <span class="far fa-comment"></span>
        ${this.replyCount}
      </a>
    `
  }

  renderPostText () {
    return unsafeHTML(linkify(makeSafe(this.post.value.text)))
  }

  renderMatchText () {
    if (!this.searchTerms) return undefined
    let v = this.post.value.text
    if (!v) return undefined
    let re = new RegExp(`(${this.searchTerms.replace(/([\s]+)/g, '|')})`, 'gi')
    let text = v.replace(re, match => `<b>${match}</b>`)
    return text // TODO unsafeHTML
  }

  // events
  // =

  onClickReply (e) {
    e.preventDefault()
    this.isReplyOpen = true
  }

  onPublishReply (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isReplyOpen = false
    emit(this, 'publish-reply')
  }

  onCancelReply (e) {
    this.isReplyOpen = false
  }

  onViewThread (e, record) {
    if (!this.viewContentOnClick && e.button === 0 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.post.url, authorId: this.post.author.userId}}})
    }
  }

  onClickCard (e) {
    for (let el of e.composedPath()) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-COMPOSER') return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  onMousedownCard (e) {
    for (let el of e.composedPath()) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-COMPOSER') return
    }
    this.isMouseDown = true
    this.isMouseDragging = false
  }

  onMousemoveCard (e) {
    if (this.isMouseDown) {
      this.isMouseDragging = true
    }
  }

  onMouseupCard (e) {
    if (!this.isMouseDown) return
    if (!this.isMouseDragging) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.post.url, authorId: this.post.author.userId}}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  onClickShowSites (e, results) {
    e.preventDefault()
    // TODO
    // SitesListPopup.create('Subscribed Sites', results.map(r => ({
    //   url: r.metadata.href,
    //   title: r.metadata.title || 'Untitled'
    // })))
  }
}

customElements.define('ctzn-post', Post)

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