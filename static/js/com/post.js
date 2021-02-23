import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { AVATAR_URL, POST_URL, FULL_POST_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify } from '../lib/strings.js'
import { writeToClipboard } from '../lib/clipboard.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from './context-menu.js'
import * as toast from './toast.js'

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
      noclick: {type: Boolean},
      hoverBgColor: {type: String, attribute: 'hover-bg-color'},
      isReplyOpen: {type: Boolean}
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
    this.noclick = false
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

  get isMyPost () {
    if (!session.isActive() || !this.post?.author.userId) {
      return false
    }
    return session.info?.userId === this.post?.author.userId
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
          <div class="px-4 py-2 min-w-0 bg-gray-50">
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
        <div class="px-2 py-3 min-w-0">
          ${this.nometa ? '' : html`
            <div class="flex pl-1 pr-2.5 text-gray-600 text-sm items-center">
              <a class="block relative" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                <img class="block w-4 h-4 object-cover rounded-full mr-2" src=${AVATAR_URL(this.post.author.userId)}>
              </a>
              <div class="mr-1 whitespace-nowrap">
                <a class="hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  <span class="text-gray-800 font-semibold">${displayNames.render(this.post.author.userId)}</span>
                </a>
              </div>
              <div class="mr-2">
                <a class="hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
                ${this.post.value.community ? html`
                  in
                  <a href="/${this.post.value.community.userId}" class="whitespace-nowrap font-semibold text-gray-700 hover:underline">
                    ${displayNames.render(this.post.value.community.userId)}
                  </a>
                ` : ''}
              </div>
            </div>
          `}
          <div
            class="whitespace-pre-wrap break-words text-gray-900 pt-1 pb-1.5 pl-7 pr-2.5"
            style="font-size: 15px; letter-spacing: 0.1px; line-height: 1.3;"
          >${this.renderPostText()}${this.post.value.extendedText
              ? html`<span class="bg-gray-200 ml-1 px-1 rounded text-gray-600 text-xs">more</span>`
              : ''
          }</div>
          ${this.nometa ? '' : html`
            <div class="flex pl-6 text-gray-500 text-sm items-center">
              ${this.renderRepliesCtrl()}
              <div>
                <a class="hover:bg-gray-200 px-1 rounded" @click=${this.onClickMenu}>
                  <span class="fas fa-fw fa-ellipsis-h"></span>
                </a>
              </div>
            </div>
          `}
        </div>
      </div>
    `
  }

  renderRepliesCtrl () {
    let aCls = `inline-block ml-1 mr-6`
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
    if (this.noclick) return
    for (let el of e.composedPath()) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-COMPOSER') return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  onMousedownCard (e) {
    if (this.noclick) return
    for (let el of e.composedPath()) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-COMPOSER') return
    }
    this.isMouseDown = true
    this.isMouseDragging = false
  }

  onMousemoveCard (e) {
    if (this.noclick) return
    if (this.isMouseDown) {
      this.isMouseDragging = true
    }
  }

  onMouseupCard (e) {
    if (this.noclick) return
    if (!this.isMouseDown) return
    if (!this.isMouseDragging) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.post.url, authorId: this.post.author.userId}}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  onClickMenu (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    let items = [
      {
        icon: 'fas fa-fw fa-link',
        label: 'Copy link',
        click: () => {
          writeToClipboard(FULL_POST_URL(this.post))
          toast.create('Copied to clipboard')
        }
      }
    ]
    if (this.isMyPost) {
      items.push('-')
      items.push({
        icon: 'fas fa-fw fa-trash',
        label: 'Delete post',
        click: () => {
          if (!confirm('Are you sure you want to delete this post?')) {
            return
          }
          emit(this, 'delete-post', {detail: {post: this.post}})
        }
      })
    }
    contextMenu.create({
      x: rect.left,
      y: rect.bottom,
      roomy: true,
      noBorders: true,
      style: `padding: 4px 0; font-size: 13px`,
      items
    })
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