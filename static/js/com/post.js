import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { AVATAR_URL, POST_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify } from '../lib/strings.js'
import * as toast from './toast.js'
import './composer.js'

export class Post extends LitElement {
  static get properties () {
    return {
      post: {type: Object},
      context: {type: String},
      searchTerms: {type: String, attribute: 'search-terms'},
      asReplyParent: {type: Boolean, attribute: 'as-reply-parent'},
      asReplyChild: {type: Boolean, attribute: 'as-reply-child'},
      nothumb: {type: Boolean},
      noborders: {type: Boolean},
      nometa: {type: Boolean},
      noctrls: {type: Boolean},
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
    this.noctrls = false
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get myVote () {
    if (this.post?.votes.upvoterIds.includes(session.info?.userId)) {
      return 1
    }
    if (this.post?.votes.downvoterIds.includes(session.info?.userId)) {
      return -1
    }
  }

  get upvoteCount () {
    return this.post?.votes.upvoterIds.length
  }

  get downvoteCount () {
    return this.post?.votes.downvoterIds.length
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

  async reloadSignals () {
    this.post.votes = await session.api.votes.getVotesForSubject(this.post.url)
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.post) {
      return html``
    }

    let gridCls = 'grid grid-cols-post'
    if (this.noborders) gridCls = 'grid grid-cols-post-tight'
    if (this.nothumb) gridCls = ''

    let borderCls = 'border border-gray-300 rounded'
    if (this.noborders) {
      borderCls = ''
    } else if (this.asReplyParent) {
      borderCls = 'border border-gray-300 border-b-0 rounded-t'
    } else if (this.asReplyChild) {
      borderCls = 'border border-gray-300 border-t-0 rounded-b'
    }

    return html`
      <div class="relative grid ${gridCls} text-gray-600">
        ${this.nothumb ? '' : html`
          <a class="block relative" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <img class="block w-8 h-8 object-cover rounded-full mr-2 mt-2" src=${AVATAR_URL(this.post.author.userId)}>
          </a>
        `}
        ${this.noborders || this.nothumb ? '' : html`<span class="post-author-arrow"></span>`}
        <div
          class="${borderCls} p-1 min-w-0 cursor-pointer hover:border-gray-400"
          @click=${this.onClickCard}
          @mousedown=${this.onMousedownCard}
          @mouseup=${this.onMouseupCard}
          @mousemove=${this.onMousemoveCard}
        >
          ${this.nometa ? '' : html`
            ${!this.noborders && !this.asReplyChild && this.post.value.community ? html`
              <div class="bg-gray-100 py-1 px-2 mb-1 text-xs rounded font-medium">
                <a href="/${this.post.value.community.userId}">
                  <span class="fas fa-fw fa-users"></span> ${this.post.value.community.userId}
                </a>
              </div>
            ` : ''}
            <div class="flex pt-1 px-2.5 text-gray-600 text-xs items-baseline">
              <div class="mr-2 whitespace-nowrap">
                <a class="text-gray-700 font-bold text-sm hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  ${this.post.author.displayName}
                </a>
                <a class="hover:underline" href="/${this.post.author.userId}" title=${this.post.author.userId}>
                  ${this.post.author.userId}
                </a>
              </div>
              <span class="mr-2 whitespace-nowrap">&middot;</span>
              <div class="whitespace-nowrap">
                <a class="hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
              </div>
            </div>
          `}
          ${this.context ? html`<div class="py-2 px-2.5 text-sm">${this.context}</div>` : ''}
          <div class="whitespace-pre-wrap break-words text-base pt-1.5 pb-2.5 px-2.5">${this.renderPostText()}</div>
          ${this.noctrls ? '' : html`<div class="px-1 pb-1 text-sm">
            ${this.renderVoteCtrl()}
            ${this.renderRepliesCtrl()}
          </div>`}
        </div>
      </div>
    `
  }

  renderVoteCtrl () {
    var myVote = this.myVote
    const aCls = `inline-block cursor-pointer text-gray-600 px-2 mr-5 rounded hover:bg-gray-100`
    return html`
      <span class="vote-ctrl">
        <a class="${aCls} ${myVote === 1 ? 'font-bold text-blue-600' : ''}" title="Upvote" @click=${e => this.onToggleVote(e, 1)}>
          <span class="far fa-thumbs-up"></span>
          <span class="count">${this.upvoteCount}</span>
        </a>
        <a class="${aCls} ${myVote === -1 ? 'font-bold text-blue-600' : ''}" title="Downvote" @click=${e => this.onToggleVote(e, -1)}>
          <span class="far fa-thumbs-down"></span>
          <span class="count">${this.downvoteCount}</span>
        </a>
      </span>
    `
  }

  renderRepliesCtrl () {
    return html`
      <a class="inline-block cursor-pointer text-gray-600 px-2 mr-5 rounded hover:bg-gray-100" @click=${this.onViewThread}>
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

  async onToggleVote (e, value) {
    if (this.myVote && this.myVote === value) {
      await session.api.votes.del(this.post.url)
    } else {
      try {
        await session.api.votes.put({
          subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
          vote: value
        })
      } catch (e) {
        toast.create(e.message, 'error')
        console.error(e)
        return
      }
    }
    this.reloadSignals()
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