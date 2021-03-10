import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { ifDefined } from '../../vendor/lit-element/lit-html/directives/if-defined.js'
import { AVATAR_URL, POST_URL, FULL_POST_URL, BLOB_URL, SUGGESTED_REACTIONS } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify, pluralize } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
import { writeToClipboard } from '../lib/clipboard.js'
import { ReactionsListPopup } from './popups/reactions-list.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from './context-menu.js'
import * as toast from './toast.js'

export class PostExpanded extends LitElement {
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
      viewContentOnClick: {type: Boolean, attribute: 'view-content-on-click'},
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
    this.nometa = false
    this.nocommunity = false
    this.noctrls = false
    this.hoverBgColor = 'gray-50'
    this.isReactionsOpen = false
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
      return `Only members of ${this.communityUserId} can interact with this post`
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

    if (this.post.error) {
      return html`
        <div class="px-4 py-2 min-w-0 bg-gray-50">
          <div class="font-semibold text-gray-600">
            <span class="fas fa-fw fa-exclamation-circle"></span>
            Failed to load post
          </div>
          ${this.post.message ? html`
            <div class="text-gray-500 text-sm">
              ${this.post.message}
            </div>
          ` : ''}
        </div>
      `
    }

    return html`
      <div class="px-4 py-3 min-w-0">
        <div class="text-gray-500 text-sm pb-2">
          <a class="inline-block w-4 h-4 relative mr-1" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <img
              class="inline-block absolute w-4 h-4 object-cover rounded-full"
              src=${AVATAR_URL(this.post.author.userId)}
              style="left: 0; top: 3px"
            >
          </a>
          <a class="hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <span class="text-gray-700 font-bold">${displayNames.render(this.post.author.userId)}</span>
          </a>
          <a class="text-gray-500 hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
            ${relativeDate(this.post.value.createdAt)}
          </a>
          ${this.post.value.community ? html`
            <span class="text-gray-600">
              in
              <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold hover:underline">
                ${displayNames.render(this.communityUserId)}
              </a>
            </span>
          ` : ''}
          <a class="hover:bg-gray-200 px-1 ml-1 rounded" @click=${this.onClickMenu}>
            <span class="fas fa-fw fa-ellipsis-h"></span>
          </a>
        </div>
        <div class="whitespace-pre-wrap break-words text-lg leading-tight font-medium text-gray-700 mb-1.5">${this.renderPostText()}</div>
        ${this.post.value.extendedText ? html`
          <div class="whitespace-pre-wrap break-words leading-snug text-gray-600 my-2">${this.renderPostExtendedText()}</div>
        ` : ''}
        ${this.renderMedia()}
        ${this.noctrls ? '' : html`
          ${this.renderReactions()}
          <div class="text-sm text-gray-600 px-1">
            ${this.renderRepliesCtrl()}
            ${this.renderReactionsBtn()}
            ${this.renderReactionsSummary()}
          </div>
          ${this.renderReactionsCtrl()}
        `}
      </div>
    `
  }

  renderMedia () {
    if (!this.post.value.media?.length) {
      return ''
    }
    const media = this.post.value.media
    const img = (item) => html`
      <a href=${BLOB_URL(this.post.author.userId, (item.blobs.original || item.blobs.thumb).blobName)} target="_blank">
        <img
          class="box-border object-cover w-full h-full ${item.caption ? 'rounded-t' : 'mb-1 rounded'}"
          src=${BLOB_URL(this.post.author.userId, (item.blobs.thumb || item.blobs.original).blobName)}
          alt=${item.caption || 'Image'}
        >
        ${item.caption ? html`
          <div class="bg-gray-100 px-3 py-1 rounded-b mb-1">${item.caption}</div>
        ` : ''}
      </a>
    `
    return html`
      <div class="mt-1 mb-2">
        ${repeat(media, item => img(item))}
      </div>
    `
  }

  renderRepliesCtrl () {
    let aCls = `inline-block mr-6 tooltip-right`
    if (this.canInteract) {
      aCls += ` text-gray-500`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${this.onViewThread} data-tooltip=${ifDefined(this.ctrlTooltip)}>
        <span class="far fa-comment"></span>
        ${this.replyCount}
      </a>
    `
  }

  renderReactionsBtn () {
    let aCls = `inline-block ml-1 mr-6 rounded`
    if (this.canInteract) {
      aCls += ` text-gray-500 cursor-pointer hover:bg-gray-200`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${e => {this.isReactionsOpen = !this.isReactionsOpen}} data-tooltip=${ifDefined(this.ctrlTooltip)}>
        <span class="fas fa-fw fa-${this.isReactionsOpen ? 'minus' : 'plus'}"></span>
      </a>
    `
  }

  renderReactionsSummary () {
    const count = this.post.reactions ? Object.values(this.post.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    let aCls = `inline-block ml-1 mr-6 rounded text-gray-500 ${count ? 'cursor-pointer hover:underline' : ''}`
    return html`
      <a class=${aCls} @click=${count ? this.onClickViewReactions : undefined}>
        <span class="far fa-hand-point-up"></span> ${count} ${pluralize(count, 'reaction')}
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
          <a
            class="inline-block text-sm px-2 py-0.5 mt-1 text-gray-500 rounded cursor-pointer bg-gray-100 sm:hover:bg-gray-200"
            @click=${this.onClickCustomReaction}
          >
            Custom...
          </a>
          ${repeat(SUGGESTED_REACTIONS, reaction => {
            const colors = this.haveIReacted(reaction) ? 'bg-green-500 sm:hover:bg-green-400 text-white' : 'bg-gray-100 sm:hover:bg-gray-200'
            return html`
              <a
                class="inline-block rounded text-sm px-2 py-0.5 mt-1 mr-1 ${colors} cursor-pointer"
                @click=${e => this.onClickReaction(e, reaction)}
              >
                ${reaction}
              </a>
            `
          })}
        </div>
      </div>
    `
  }

  renderReactions () {
    if (!this.post.reactions || !Object.keys(this.post.reactions).length) {
      return ''
    }
    return html`
      <div class="my-1.5 text-gray-500 text-sm">
        ${repeat(Object.entries(this.post.reactions), ([reaction, userIds]) => {
          const colors = this.haveIReacted(reaction) ? 'bg-blue-50 sm:hover:bg-blue-100 text-blue-600' : 'bg-gray-100 sm:hover:bg-gray-200'
          return html`
            <a
              class="inline-block mt-1 px-1.5 py-0.5 rounded cursor-pointer ${colors}"
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
    return unsafeHTML(emojify(linkify(makeSafe(this.post.value.text))))
  }

  renderPostExtendedText () {
    return unsafeHTML(emojify(linkify(makeSafe(this.post.value.extendedText))))
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
      x: rect.right,
      y: rect.bottom,
      right: true,
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

  onClickViewReactions (e) {
    ReactionsListPopup.create({
      reactions: this.post.reactions
    })
  }
}

customElements.define('ctzn-post-expanded', PostExpanded)

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