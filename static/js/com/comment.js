import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { ifDefined } from '../../vendor/lit-element/lit-html/directives/if-defined.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { AVATAR_URL, COMMENT_URL, FULL_COMMENT_URL, SUGGESTED_REACTIONS } from '../lib/const.js'
import { writeToClipboard } from '../lib/clipboard.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify, pluralize } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
import { ReactionsListPopup } from './popups/reactions-list.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from './context-menu.js'
import * as toast from './toast.js'
import './comment-composer.js'

export class Comment extends LitElement {
  static get properties () {
    return {
      comment: {type: Object},
      context: {type: String},
      searchTerms: {type: String, attribute: 'search-terms'},
      isReplyOpen: {type: Boolean},
      isReactionsOpen: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.comment = undefined
    this.context = undefined
    this.searchTerms = undefined
    this.isReplyOpen = false
    this.isReactionsOpen = false
  }

  get communityUserId () {
    return this.comment?.value?.community?.userId
  }

  get isMyComment () {
    if (!session.isActive() || !this.comment?.author.userId) {
      return false
    }
    return session.info?.userId === this.comment?.author.userId
  }

  get canInteract () {
    if (this.communityUserId) {
      return session.isInCommunity(this.communityUserId)
    }
    return session.isFollowingMe(this.comment.author.userId)
  }

  get ctrlTooltip () {
    if (this.canInteract) return undefined
    if (this.communityUserId) {
      return `Only members of ${this.communityUserId} can interact with this comment`
    }
    return `Only people followed by ${this.comment.author.displayName} can interact with this comment`
  }

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.comment.reactions?.[reaction]?.includes(session.info.userId)
  }

  getMyReactions () {
    if (!session.isActive()) return []
    if (!this.comment.reactions) return []
    return Object.keys(this.comment.reactions).filter(reaction => {
      return this.comment.reactions[reaction].includes(session.info.userId)
    })
  }

  async reloadSignals () {
    this.comment.reactions = (await session.api.view.get('ctzn.network/reactions-to-view', this.comment.url))?.reactions
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.comment) {
      return html``
    }

    if (this.comment.error) {
      return html`
        <div class="${borderCls} px-4 py-2 min-w-0 bg-gray-50">
          <div class="font-semibold text-gray-600">
            <span class="fas fa-fw fa-exclamation-circle"></span> Failed to load comment
          </div>
          ${this.comment.message ? html`
            <div class="text-gray-500 text-sm">
              ${this.comment.message}
            </div>
          ` : ''}
        </div>
      `
    }

    return html`
      <div class="text-gray-600">
        ${this.context ? html`
          <div class="pt-2 pb-1 text-sm text-gray-500 font-bold">
            ${this.context}
          </div>
        ` : ''}
        <div class="py-2 min-w-0">
          <div class="flex pr-2.5 text-gray-500 text-xs items-center">
            <a class="block relative" href="/${this.comment.author.userId}" title=${this.comment.author.displayName}>
              <img class="block w-4 h-4 object-cover rounded-full mr-1" src=${AVATAR_URL(this.comment.author.userId)}>
            </a>
            <div class="whitespace-nowrap">
              <a class="hover:underline" href="/${this.comment.author.userId}" title=${this.comment.author.displayName}>
                <span class="text-gray-700 font-medium">${displayNames.render(this.comment.author.userId)}</span>
              </a>
            </div>
            <span class="mx-1">&middot;</span>
            <a class="text-gray-500 hover:underline" href="${COMMENT_URL(this.comment)}" data-tooltip=${(new Date(this.comment.value.createdAt)).toLocaleString()}>
              ${relativeDate(this.comment.value.createdAt)}
            </a>
          </div>
          <div class="whitespace-pre-wrap break-words text-base leading-snug text-gray-700 pt-2 pb-1.5 pl-5 pr-2.5">${this.renderCommentText()}</div>
          ${this.renderReactions()}
          <div class="pl-4">
            <a
              class="cursor-pointer tooltip-right hover:bg-gray-100 px-2 py-1 text-xs text-gray-500 font-bold"
              data-tooltip=${ifDefined(this.ctrlTooltip)}
              @click=${this.onClickReply}
            >
              <span class="fas fa-fw fa-reply"></span> Reply
            </a>
            <a
              class="cursor-pointer tooltip-right hover:bg-gray-100 px-2 py-1 text-xs text-gray-500 font-bold"
              data-tooltip=${ifDefined(this.ctrlTooltip)}
              @click=${e => {this.isReactionsOpen = !this.isReactionsOpen}}
            >
              <span class="fas fa-fw fa-${this.isReactionsOpen ? 'minus' : 'plus'}"></span>
            </a>
            ${this.renderReactionsSummary()}
            <a
              class="cursor-pointer tooltip-right hover:bg-gray-100 px-2 py-1 text-xs text-gray-500 font-bold"
              @click=${this.onClickMenu}
            >
              <span class="fas fa-fw fa-ellipsis-h"></span>
            </a>
          </div>
          ${this.renderReactionsCtrl()}
          ${this.isReplyOpen ? html`
            <div class="border border-gray-300 rounded py-2 px-3 my-2 mx-1 bg-white">
              <ctzn-comment-composer
                autofocus
                .community=${this.comment.value.community}
                .subject=${this.comment.value.reply.root}
                .parent=${{dbUrl: this.comment.url, authorId: this.comment.author.userId}}
                placeholder="Write your reply"
                @publish=${this.onPublishReply}
                @cancel=${this.onCancelReply}
              ></ctzn-comment-composer>
            </div>
          ` : ''}
        </div>
      </div>
    `
  }

  renderCommentText () {
    return unsafeHTML(emojify(linkify(makeSafe(this.comment.value.text))))
  }

  renderReactionsCtrl () {
    if (!this.isReactionsOpen) {
      return ''
    }
    return html`
      <div class="pl-5">
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
    if (!this.comment.reactions || !Object.keys(this.comment.reactions).length) {
      return ''
    }
    return html`
      <div class="pb-1 pl-5 text-gray-500 text-sm">
        ${repeat(Object.entries(this.comment.reactions), ([reaction, userIds]) => {
          const colors = this.haveIReacted(reaction) ? 'bg-blue-50 sm:hover:bg-blue-100 text-blue-600' : 'bg-gray-100 sm:hover:bg-gray-200'
          return html`
            <a
              class="inline-block mr-1.5 px-1.5 py-0.5 rounded cursor-pointer ${colors}"
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

  renderReactionsSummary () {
    const count = this.comment.reactions ? Object.values(this.comment.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    let aCls = `inline-block ml-1 mr-6 rounded text-sm text-gray-500 ${count ? 'cursor-pointer hover:underline' : ''}`
    return html`
      <a class=${aCls} @click=${count ? this.onClickViewReactions : undefined}>
        ${count} ${pluralize(count, 'reaction')}
      </a>
    `
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
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.comment.url, authorId: this.comment.author.userId}}})
    }
  }

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    if (this.haveIReacted(reaction)) {
      this.comment.reactions[reaction] = this.comment.reactions[reaction].filter(userId => userId !== session.info.userId)
      this.requestUpdate()
      await session.api.reactions.del(this.comment.url, reaction)
    } else {
      this.comment.reactions[reaction] = (this.comment.reactions[reaction] || []).concat([session.info.userId])
      this.requestUpdate()
      await session.api.reactions.put({
        subject: {dbUrl: this.comment.url, authorId: this.comment.author.userId},
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
      subject: {dbUrl: this.comment.url, authorId: this.comment.author.userId},
      reaction
    })
    this.comment.reactions[reaction] = (this.comment.reactions[reaction] || []).concat([session.info.userId])
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
          writeToClipboard(FULL_COMMENT_URL(this.comment))
          toast.create('Copied to clipboard')
        }
      }
    ]
    if (this.isMyComment) {
      items.push('-')
      items.push({
        icon: 'fas fa-fw fa-trash',
        label: 'Delete comment',
        click: () => {
          if (!confirm('Are you sure you want to delete this comment?')) {
            return
          }
          emit(this, 'delete-comment', {detail: {comment: this.comment}})
        }
      })
    }
    if (this.communityUserId && session.isInCommunity(this.communityUserId)) {
      items.push(
        session.api.view.get(
          'ctzn.network/community-user-permission-view',
          this.communityUserId,
          session.info.userId,
          'ctzn.network/perm-community-remove-comment'
        ).then(perm => {
          if (perm) {
            return html`
              <div class="dropdown-item" @click=${() => this.onClickModeratorRemove()}>
                <i class="fas fa-times fa-fw"></i>
                Remove comment (moderator)
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
    if (!confirm('Are you sure you want to remove this comment?')) {
      return
    }
    emit(this, 'moderator-remove-comment', {detail: {comment: this.comment}})
  }

  onClickViewReactions (e) {
    ReactionsListPopup.create({
      reactions: this.comment.reactions
    })
  }
}

customElements.define('ctzn-comment', Comment)

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