import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { POST_URL, FULL_POST_URL, BLOB_URL, SUGGESTED_REACTIONS } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
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
      light: {type: Boolean},
      hoverBgColor: {type: String, attribute: 'hover-bg-color'},
      isReplyOpen: {type: Boolean},
      isReactionsOpen: {type: Boolean}
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
    this.light = false
    this.hoverBgColor = 'gray-50'
    this.viewContentOnClick = false
    this.isReactionsOpen = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  get communityUserId () {
    return this.post?.value?.community?.userId
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
    if (this.communityUserId) {
      return session.isInCommunity(this.communityUserId)
    }
    return session.isFollowingMe(this.post.author.userId)
  }

  get ctrlTooltip () {
    if (this.canInteract) return undefined
    if (this.communityUserId) {
      return `Only members of ${displayNames.render(this.communityUserId)} can interact with this post`
    }
    return `Only people followed by ${this.post.author.displayName} can interact with this post`
  }

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.post.reactions?.[reaction]?.includes(session.info.userId)
  }

  getMyReactions () {
    if (!session.isActive()) return []
    if (!this.post.reactions) return []
    return Object.keys(this.post.reactions).filter(reaction => {
      return this.post.reactions[reaction].includes(session.info.userId)
    })
  }

  async reloadSignals () {
    this.post.reactions = (await session.api.reactions.getReactionsForSubject(this.post.url))?.reactions
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
        class="relative text-gray-600 cursor-pointer"
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
        <div class="${this.nometa ? '' : 'pr-2 py-2 sm:px-2 sm:py-3'} min-w-0">
          ${this.nometa ? '' : html`
            <div class="pl-1 pr-2.5 text-gray-600 truncate">
              <span class="sm:mr-1 whitespace-nowrap">
                <a class="hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                  <span class="text-gray-800 font-semibold">${displayNames.render(this.post.author.userId)}</span>
                </a>
              </span>
              <span class="mr-2 text-sm">
                <a class="hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                  ${relativeDate(this.post.value.createdAt)}
                </a>
                ${this.post.value.community ? html`
                  in
                  <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold text-gray-700 hover:underline">
                    ${displayNames.render(this.communityUserId)}
                  </a>
                ` : ''}
              </span>
            </div>
          `}
          <div
            class="whitespace-pre-wrap break-words text-gray-${this.light ? '500' : '900'} ${this.nometa ? '' : 'pt-1 pb-2 pl-1 pr-2.5'}"
            style="font-size: 16px; letter-spacing: 0.1px; line-height: 1.3;"
          >${this.renderPostText()}${this.post.value.extendedText
              ? html`<span class="bg-gray-200 ml-1 px-1 rounded text-gray-600 text-xs">more</span>`
              : ''
          }</div>
          ${this.nometa ? '' : html`
            ${this.renderMedia()}
            <div class="flex pl-1 text-gray-500 text-sm items-center">
              ${this.renderRepliesCtrl()}
              ${this.renderReactionsBtn()}
              <div>
                <a class="hover:bg-gray-200 px-1 rounded" @click=${this.onClickMenu}>
                  <span class="fas fa-fw fa-ellipsis-h"></span>
                </a>
              </div>
            </div>
            ${this.renderReactions()}
            ${this.renderReactionsCtrl()}
          `}
        </div>
      </div>
    `
  }

  renderMedia () {
    if (!this.post.value.media?.length) {
      return ''
    }
    const media = this.post.value.media
    const img = (item, size) => html`
      <div class="bg-gray-100 rounded img-sizing-${size} img-placeholder">
        <img
          class="box-border object-cover rounded w-full img-sizing-${size}"
          src="${BLOB_URL(this.post.author.userId, (item.blobs.thumb || item.blobs.original).blobName)}"
          alt=${item.caption || 'Image'}
        >
      </div>
    `
    const moreImages = media.length - 4
    return html`
      <div class="flex mt-1">
        ${media.length >= 4 ? html`
          <div class="flex-1 flex flex-col pr-0.5">
            <div class="flex-1 pb-0.5">${img(media[0], 'small')}</div>
            <div class="flex-1 pt-0.5">${img(media[2], 'small')}</div>
          </div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${img(media[1], 'small')}</div>
            <div class="flex-1 pt-0.5">${img(media[3], 'small')}</div>
          </div>
        ` : media.length === 3 ? html`
          <div class="flex-1 pr-0.5">${img(media[0], 'big')}</div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${img(media[1], 'smaller')}</div>
            <div class="flex-1 pt-0.5">${img(media[2], 'smaller')}</div>
          </div>
        ` : media.length === 2 ? html`
          <div class="flex-1 pr-0.5">${img(media[0], 'small')}</div>
          <div class="flex-1 pl-0.5">${img(media[1], 'small')}</div>
        ` : html`
          <div class="flex-1">${img(media[0], 'big')}</div>
        `}
      </div>
      <div class="mb-3">
        ${moreImages > 0 ? html`<div class="bg-gray-100 font-bold mt-1 px-2 py-0.5 rounded text-sm">+${moreImages} more...</div>` : ''}
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

  renderReactionsBtn () {
    let aCls = `inline-block ml-1 mr-6 rounded`
    if (this.canInteract) {
      aCls += ` text-gray-500 hover:bg-gray-200`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${e => {this.isReactionsOpen = !this.isReactionsOpen}}>
        <span class="fas fa-fw fa-${this.isReactionsOpen ? 'minus' : 'plus'}"></span>
      </a>
    `
  }

  renderReactionsCtrl () {
    if (!this.isReactionsOpen) {
      return ''
    }
    return html`
      <div>
        <div class="font-semibold pt-2 px-1 text-gray-500 text-xs">
          Add a reaction
        </div>
        <div class="overflow-x-auto px-1 sm:whitespace-normal whitespace-nowrap">
          ${repeat(SUGGESTED_REACTIONS, reaction => {
            const colors = this.haveIReacted(reaction) ? 'bg-green-500 sm:hover:bg-green-400 text-white' : 'bg-gray-100 sm:hover:bg-gray-200'
            return html`
              <a
                class="inline-block rounded text-sm px-2 py-0.5 mt-1 mr-1 cursor-pointer ${colors}"
                @click=${e => this.onClickReaction(e, reaction)}
              >
                ${reaction}
              </a>
            `
          })}
          <a
            class="inline-block text-sm px-2 py-0.5 mt-1 text-gray-500 rounded cursor-pointer sm:hover:bg-gray-100"
            @click=${this.onClickCustomReaction}
          >
            Custom
          </a>
        </div>
      </div>
    `
  }

  renderReactions () {
    if (!this.post.reactions || !Object.keys(this.post.reactions).length) {
      return ''
    }
    return html`
      <div class="mt-1.5 mx-1 text-gray-500 text-sm truncate">
        ${repeat(Object.entries(this.post.reactions), ([reaction, userIds]) => {
          const colors = this.haveIReacted(reaction) ? 'bg-blue-50 sm:hover:bg-blue-100 text-blue-600' : 'bg-gray-100 sm:hover:bg-gray-200'
          return html`
            <a
              class="inline-block mr-1.5 px-1.5 py-0.5 rounded ${colors}"
              @click=${e => this.onClickReaction(e, reaction)}
            >
              ${unsafeHTML(emojify(makeSafe(reaction)))}
              <sup class="font-medium">${userIds.length}</sup>
            </a>
          `
        })}
      </div>
    `
  }

  renderPostText () {
    return html`${unsafeHTML(linkify(emojify(makeSafe(this.post.value.text))))}`
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

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    if (this.haveIReacted(reaction)) {
      this.post.reactions[reaction] = this.post.reactions[reaction].filter(userId => userId !== session.info.userId)
      this.requestUpdate()
      await session.api.reactions.del(this.post.url, reaction)
    } else {
      this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.userId])
      this.requestUpdate()
      await session.api.reactions.put({
        subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
        reaction
      })
    }
    this.isReactionsOpen = false
    this.reloadSignals()
  }

  async onClickCustomReaction (e) {
    e.preventDefault()
    e.stopPropagation()

    let reaction
    do {
      reaction = prompt('Type your reaction')
      if (!reaction) return
      reaction = reaction.toLowerCase()
      if (reaction.length < 16) break
      alert('Sorry, reactions can be no longer than 16 characters.')
    } while (true)

    if (this.haveIReacted(reaction)) {
      return
    }
    await session.api.reactions.put({
      subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
      reaction
    })
    this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.userId])
    this.requestUpdate()
    this.isReactionsOpen = false
    this.reloadSignals()
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
    if (this.communityUserId && session.isInCommunity(this.communityUserId)) {
      items.push(
        session.api.communities.getUserPermission(
          this.communityUserId,
          session.info.userId,
          'ctzn.network/perm-community-remove-post'
        ).then(perm => {
          if (perm) {
            return html`
              <div class="dropdown-item" @click=${() => this.onClickModeratorRemove()}>
                <i class="fas fa-times fa-fw"></i>
                Remove post (moderator)
              </div>
            `
          } else {
            return ''
          }
        })
      )
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

  onClickModeratorRemove () {
    if (!confirm('Are you sure you want to remove this post?')) {
      return
    }
    emit(this, 'moderator-remove-post', {detail: {post: this.post}})
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