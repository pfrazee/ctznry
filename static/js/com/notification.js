import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { asyncReplace } from '../../vendor/lit-element/lit-html/directives/async-replace.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import { extractSchemaId } from '../lib/strings.js'
import { getPost, getComment } from '../lib/getters.js'
import './post.js'

export class Notification extends LitElement {
  static get properties () {
    return {
      notification: {type: Object},
      isUnread: {type: Boolean, attribute: 'is-unread'},
      isReplyOpen: {type: Boolean},
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.notification = undefined
    this.isUnread = false
    this.viewContentOnClick = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get schemaId () {
    if (!this.notification) return ''
  }

  get replyCount () {
    if (typeof this.notification?.replyCount !== 'undefined') {
      return this.notification.replyCount
    }
    if (typeof this.notification?.replies !== 'undefined') {
      return this.notification.replies.length
    }
    return 0
  }

  // rendering
  // =

  render () {
    const note = this.notification
    const schemaId = extractSchemaId(note.itemUrl)

    if (!note.item) {
      console.warn('Malformed notification, skipping render', note)
      return ''
    }

    let subject
    let subjectSchemaId
    let replyCommentInfo

    var icon
    var action = ''
    if (schemaId === 'ctzn.network/comment') {
      replyCommentInfo = {
        userId: note.author.userId,
        dbUrl: note.itemUrl
      }
      if (note.item.reply?.parent && note.item.reply?.parent.dbUrl.startsWith(session.info.dbUrl)) {
        subject = note.item.reply.parent
      } else {
        subject = note.item.reply.root
      }
      action = 'replied to'
      icon = 'fas fa-reply'
    } else if (schemaId === 'ctzn.network/follow') {
      subject = note.item.subject
      action = 'followed'
      icon = 'fas fa-user-plus'
    } else {
      return ''
    }

    subjectSchemaId = subject ? extractSchemaId(subject.dbUrl): undefined
    var target = ''
    if (['ctzn.network/post', 'ctzn.network/comment'].includes(subjectSchemaId)) {
      target = `your ${subjectSchemaId === 'ctzn.network/post' ? 'post' : 'comment'}`
    } else if (!subjectSchemaId) {
      target = 'you'
    }
    
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <div class="cursor-pointer hover:bg-gray-50 ${this.isUnread ? 'unread' : ''}" @click=${this.onClickWrapper}>
        <div class="flex items-center text-sm pt-4 px-4 pb-2">
          <span class="${icon} text-2xl mr-4 ml-1 text-gray-400"></span>
          <a href="/${note.author.userId}" title=${note.author.userId}>
            <img class="w-8 h-8 rounded-full object-cover mr-2" src=${AVATAR_URL(note.author.userId)}>
          </a>
        </div>
        <div class="pl-16 pr-4 pb-2">
          <a class="font-bold" href="/${note.author.userId}" title=${note.author.userId}>
           ${note.author.userId}
          </a>
          ${action} ${target} &middot; ${relativeDate(note.blendedCreatedAt)}
        </div>
        ${schemaId === 'ctzn.network/comment' ? html`
          <div class="reply pl-16 pb-4 pr-6">
            ${asyncReplace(this.renderReplyComment(replyCommentInfo))}
          </div>
        ` : html`
          <div class="pb-2"></div>
        `}
      </div>
    `
  }


  async *renderSubject ({dbUrl, authorId}, schemaId) {
    yield html`Loading...`

    let record
    if (schemaId === 'ctzn.network/post') {
      record = await getPost(authorId, dbUrl)
      yield html`
        <ctzn-post
          .post=${record}
          nometa
        ></ctzn-post>
      `
    } else if (schemaId === 'ctzn.network/comment') {
      record = await getComment(authorId, dbUrl)
      yield html`
        <ctzn-post
          .post=${record}
          nometa
          noclick
        ></ctzn-post>
      `
    }
  }

  async *renderReplyComment (commentInfo) {
    yield html`Loading...`

    let record = await getComment(commentInfo.userId, commentInfo.dbUrl)
    yield html`
      <ctzn-post
        .post=${record}
        nometa
        noclick
      ></ctzn-post>
    `
  }

  // events
  // =

  async onClickWrapper (e) {
    e.preventDefault()

    const schemaId = extractSchemaId(this.notification.itemUrl)
    if (schemaId === 'ctzn.network/post'){
      const subject = await getPost(this.notification.author.userId, this.notification.itemUrl)
      emit(this, 'view-thread', {detail: {subject: {dbUrl: subject.url, authorId: subject.author.userId}}})
    } else if (schemaId === 'ctzn.network/comment') {
      const subject = await getComment(this.notification.author.userId, this.notification.itemUrl)
      // const subject = await getPost(comment.value.reply.root.authorId, comment.value.reply.root.dbUrl)
      emit(this, 'view-thread', {detail: {subject: {dbUrl: subject.url, authorId: subject.author.userId}}})
    } else if (schemaId === 'ctzn.network/follow') {
      window.location = `/${this.notification.author.userId}`
    }
  }
}

customElements.define('ctzn-notification', Notification)

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