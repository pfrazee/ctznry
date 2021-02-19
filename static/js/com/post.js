import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { AVATAR_URL, POST_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify } from '../lib/strings.js'
import * as displayNames from '../lib/display-names.js'
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

    const showingCommunity = !this.nocommunity && !this.asReplyChild && this.post.value.community
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
        ` : showingCommunity ? html`
          <div class="pt-2 pb-1 text-sm text-gray-500 font-bold" style="padding-left: 33px">
            <span class="fas fa-fw fa-users mr-1"></span>
            Posted to
            <a href="/${this.post.value.community.userId}" class="whitespace-nowrap hover:underline">
              ${displayNames.render(this.post.value.community.userId)}
            </a>
          </div>
        ` : ''}
        <div class="${gridCls} ${!showingCommunity ? 'pt-2' : ''} ">
          ${this.noctrls ? '' : html`
            <a class="block relative" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
              <img class="block w-10 h-10 object-cover rounded-full ml-2.5 mt-1" src=${AVATAR_URL(this.post.author.userId)}>
            </a>
          `}
          <div class="px-1 pb-2 min-w-0">
            ${this.nometa ? '' : html`
              <div class="flex pl-1 pr-2.5 text-gray-500 text-sm items-baseline">
                <div class="mr-2 whitespace-nowrap">
                  <a class="text-gray-700 font-bold text-base hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                    ${this.post.author.displayName}
                  </a>
                </div>
                <span class="mr-2 whitespace-nowrap">&middot;</span>
                <div class="mr-2 whitespace-nowrap">
                  <a class="hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                    ${relativeDate(this.post.value.createdAt)}
                  </a>
                </div>
              </div>
            `}
            <div class="whitespace-pre-wrap break-words text-base text-gray-700 pt-.5 pb-1.5 pl-1 pr-2.5">${this.renderPostText()}</div>
            ${this.noctrls ? '' : html`<div class="pr-1 pb-1 text-base">
              ${this.renderRepliesCtrl()}
              ${this.renderVoteCtrl()}
            </div>`}
          </div>
        </div>
      </div>
    `
  }

  renderVoteCtrl () {
    var myVote = this.myVote
    let aCls = `inline-block px-2`
    if (this.canInteract) {
      aCls += ` text-gray-500 cursor-pointer hover:bg-gray-200`
    } else {
      aCls += ` text-gray-400`
    }
    const onClick = (v) => {
      if (this.canInteract) {
        return e => this.onToggleVote(e, v)
      }
    }
    return html`
      <a
        class="${aCls} tooltip-right ${myVote === 1 ? 'font-bold text-blue-600' : ''}"
        @click=${onClick(1)}
        data-tooltip=${this.ctrlTooltip || 'Upvote'}
      >
        <span class="fas fa-caret-up"></span>
      </a>
      <span class="${myVote ? 'font-bold' : ''} ${myVote === 1 ? 'text-blue-600' : ''} ${myVote === -1 ? 'text-red-600' : ''}">
        ${this.upvoteCount - this.downvoteCount}
      </span>
      <a
        class="${aCls} tooltip-right ${myVote === -1 ? 'font-bold text-red-600' : ''}"
        @click=${onClick(-1)}
        data-tooltip=${this.ctrlTooltip || 'Downvote'}
      >
        <span class="fas fa-caret-down"></span>
      </a>
    `
  }

  renderRepliesCtrl () {
    let aCls = `inline-block px-2 mr-8 tooltip-right`
    if (this.canInteract) {
      aCls += ` text-gray-500 cursor-pointer hover:bg-gray-100`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${this.onViewThread} data-tooltip=${this.ctrlTooltip || 'Replies'}>
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