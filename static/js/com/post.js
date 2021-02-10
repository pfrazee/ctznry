import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { classMap } from '../../vendor/lit-element/lit-html/directives/class-map.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import css from '../../css/com/post.css.js'
import { emit } from '../lib/dom.js'
import * as toast from './toast.js'
import './composer.js'

export class Post extends LitElement {
  static get properties () {
    return {
      post: {type: Object},
      context: {type: String},
      searchTerms: {type: String, attribute: 'search-terms'},
      isReplyOpen: {type: Boolean},
      nometa: {type: Boolean},
      noctrls: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  static get styles () {
    return css
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

    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      <div
        class=${classMap({
          post: true,
          card: true,
          'in-community': !!this.post?.value.community && !this.classList.contains('child-post')
        })}
      >
        <a class="thumb" href="/${this.post.author.userId}" title=${this.post.author.displayName} data-tooltip=${this.post.author.displayName}>
          <img class="favicon" src=${AVATAR_URL(this.post.author.userId)}>
        </a>
        <span class="arrow"></span>
        <div
          class="container"
          @click=${this.onClickCard}
          @mousedown=${this.onMousedownCard}
          @mouseup=${this.onMouseupCard}
          @mousemove=${this.onMousemoveCard}
        >
          ${this.nometa ? '' : html`
            ${this.post.value.community ? html`
              <div class="community">
                <a href="/${this.post.value.community.userId}">
                  <span class="fas fa-fw fa-users"></span> ${this.post.value.community.userId}
                </a>
              </div>
            ` : ''}
            <div class="header">
              <div class="origin">
                <a class="author displayname" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  ${this.post.author.displayName}
                </a>
                <a class="author username" href="/${this.post.author.userId}" title=${this.post.author.userId}>
                  ${this.post.author.userId}
                </a>
              </div>
              <span>&middot;</span>
              <div class="date">
                <a href="#todo" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
              </div>
            </div>
          `}
          ${this.context ? html`<div class="context">${this.context}</div>` : ''}
          <div class="content markdown">
            ${this.post.value.text ? (this.renderMatchText() || this.post.value.text) : ''}
          </div>
          ${this.noctrls ? '' : html`<div class="ctrls">
            ${this.renderVoteCtrl()}
            ${this.renderRepliesCtrl()}
          </div>`}
        </div>
      </div>
    `
  }

  renderVoteCtrl () {
    var myVote = this.myVote
    return html`
      <span class="vote-ctrl">
        <a class="up ${myVote === 1 ? 'pressed' : ''}" data-tooltip="Upvote" @click=${e => this.onToggleVote(e, 1)}>
          <span class="far fa-thumbs-up"></span>
          <span class="count">${this.upvoteCount}</span>
        </a>
        <a class="down ${myVote === -1 ? 'pressed' : ''}" data-tooltip="Downvote" @click=${e => this.onToggleVote(e, -1)}>
          <span class="far fa-thumbs-down"></span>
          <span class="count">${this.downvoteCount}</span>
        </a>
      </span>
    `
  }

  renderRepliesCtrl () {
    return html`
      <a class="reply-ctrl" @click=${this.onViewThread}>
        <span class="far fa-comment"></span>
        ${this.replyCount}
      </a>
    `
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
    for (let el of e.path) {
      if (el.tagName === 'A' || el.tagName === 'CTZN-COMPOSER') return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  onMousedownCard (e) {
    for (let el of e.path) {
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