import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { ifDefined } from '../../vendor/lit-element/lit-html/directives/if-defined.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { AVATAR_URL, ITEM_CLASS_ICON_URL, COMMENT_URL, FULL_COMMENT_URL, SUGGESTED_REACTIONS } from '../lib/const.js'
import { writeToClipboard } from '../lib/clipboard.js'
import { CommentComposerPopup } from './popups/comment-composer.js'
import { TransferItemRelatedPopup } from './popups/transfer-item-related.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify, pluralize } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
import { ReactionsListPopup } from './popups/reactions-list.js'
import { RelatedItemTransfersListPopup } from './popups/related-item-transfers-list.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from './context-menu.js'
import * as toast from './toast.js'
import './comment-composer.js'
import './reaction-input.js'

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

  get hasReactionsOrGifts () {
    return (
      this.comment.relatedItemTransfers?.length > 0
      || (this.comment.reactions && Object.keys(this.comment.reactions).length > 0)
    )
  }

  async reloadSignals () {
    this.comment.reactions = (await session.ctzn.view('ctzn.network/reactions-to-view', this.comment.url))?.reactions
    if (this.communityUserId) {
      this.comment.relatedItemTransfers = (
        await session.ctzn.db(`server@${this.communityUserId.split('@')[1]}`)
          .table('ctzn.network/item-tfx-relation-idx')
          .get(this.comment.url)
      )?.value.transfers
    }
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
              <a class="hov:hover:underline" href="/${this.comment.author.userId}" title=${this.comment.author.displayName}>
                <span class="text-gray-700 font-medium">${displayNames.render(this.comment.author.userId)}</span>
              </a>
            </div>
            <span class="mx-1">&middot;</span>
            <a class="text-gray-500 hov:hover:underline" href="${COMMENT_URL(this.comment)}" data-tooltip=${(new Date(this.comment.value.createdAt)).toLocaleString()}>
              ${relativeDate(this.comment.value.createdAt)}
            </a>
          </div>
          <div class="whitespace-pre-wrap break-words text-base leading-snug text-gray-700 pt-2 pb-1.5 pl-5 pr-2.5">${this.renderCommentText()}</div>
          ${this.hasReactionsOrGifts ? html`
            <div class="pb-1 pl-5">
              ${this.renderGiftedItems()}
              ${this.renderReactions()}
            </div>
          ` : ''}
          <div class="pl-4">
            <a
              class="tooltip-right px-2 py-1 text-xs font-bold ${this.canInteract ? 'cursor-pointer text-gray-500 hov:hover:bg-gray-100' : 'text-gray-400'}"
              data-tooltip=${ifDefined(this.ctrlTooltip)}
              @click=${this.canInteract ? this.onClickReply : undefined}
            >
              <span class="fas fa-fw fa-reply"></span> Reply
            </a>
            <a
              class="tooltip-right px-2 py-1 text-xs font-bold ${this.canInteract ? 'cursor-pointer text-gray-500 hov:hover:bg-gray-100' : 'text-gray-400'}"
              data-tooltip=${ifDefined(this.ctrlTooltip)}
              @click=${this.canInteract ? (e => {this.isReactionsOpen = !this.isReactionsOpen}) : undefined}
            >
              <span class="fas fa-fw fa-${this.isReactionsOpen ? 'minus' : 'plus'}"></span>
            </a>
            ${this.renderGiftItemBtn()}
            ${this.renderActionsSummary()}
            <a
              class="cursor-pointer tooltip-right hov:hover:bg-gray-100 px-2 py-1 ml-2 text-xs text-gray-500 font-bold"
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
      <ctzn-reaction-input
        .reactions=${this.comment.reactions}
        @toggle-reaction=${this.onToggleReaction}
      ></ctzn-reaction-input>
    `
  }

  renderReactions () {
    if (!this.comment.reactions || !Object.keys(this.comment.reactions).length) {
      return ''
    }
    return html`
      ${repeat(Object.entries(this.comment.reactions), ([reaction, userIds]) => {
        const colors = this.haveIReacted(reaction) ? 'bg-blue-50 hov:hover:bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hov:hover:bg-gray-200'
        return html`
          <a
            class="inline-block mr-1 px-1.5 py-0.5 mt-1 text-sm rounded cursor-pointer ${colors}"
            @click=${e => this.onClickReaction(e, reaction)}
          >
            ${unsafeHTML(emojify(makeSafe(reaction)))}
            <sup class="font-medium">${userIds.length}</sup>
          </a>
        `
      })}
    `
  }

  renderGiftedItems () {
    if (!this.comment.relatedItemTransfers?.length) {
      return ''
    }
    return html`
      ${repeat(this.comment.relatedItemTransfers, item => html`
        <span
          class="inline-block border border-gray-300 px-1 py-0.5 rounded mt-1 mr-1 text-sm font-semibold"
        >
          <img
            class="inline relative w-4 h-4 object-cover mr-1"
            src=${ITEM_CLASS_ICON_URL(this.communityUserId, item.itemClassId)}
            style="top: -1px"
          >
          ${item.qty}
        </span>
      `)}
    `
  }

  renderGiftItemBtn () {
    let aCls = `inline-block px-1 rounded px-2 py-1 text-xs`
    if (this.communityUserId && this.canInteract && !this.isMyComment) {
      return html`
        <a class="${aCls} text-gray-500 cursor-pointer hov:hover:bg-gray-100" @click=${this.onClickGiftItem}>
          <span class="fas fa-fw fa-gift"></span>
        </a>
      `
    } else {
      const tooltip = this.isMyComment
        ? `Can't gift to yourself`
        : this.communityUserId
          ? `Must be a member of the community`
          : `Must be a community post`
      return html`
        <a class="${aCls} text-gray-300 tooltip-top" data-tooltip=${tooltip}>
          <span class="fas fa-fw fa-gift"></span>
        </a>
      `
    }
  }

  renderActionsSummary () {
    const reactionsCount = this.comment.reactions ? Object.values(this.comment.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    const giftsCount = this.comment.relatedItemTransfers?.length || 0
    let reactionsCls = `inline-block ml-1 text-sm text-gray-500 ${reactionsCount ? 'cursor-pointer hov:hover:underline' : ''}`
    return html`
      <a class=${reactionsCls} @click=${reactionsCount ? this.onClickViewReactions : undefined}>
        ${reactionsCount} ${pluralize(reactionsCount, 'reaction')}${giftsCount > 0 ? ', ' : ''}
      </a>
      ${giftsCount > 0 ? html`
        <a class="inline-block ml-1 text-sm rounded text-gray-500 cursor-pointer hov:hover:underline" @click=${this.onClickViewGifts}>
          ${giftsCount} ${pluralize(giftsCount, 'gift')}
        </a>
      ` : ''}
    `
  }

  // events
  // =

  async onClickReply (e) {
    e.preventDefault()
    if (matchMedia('(max-width: 1150px)').matches) {
      await CommentComposerPopup.create({
        comment: this.comment
      })
      emit(this, 'publish-reply')
    } else {
      this.isReplyOpen = true
    }
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

  onToggleReaction (e) {
    this.onClickReaction(e, e.detail.reaction)
  }

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    this.isReactionsOpen = false
    if (this.haveIReacted(reaction)) {
      this.comment.reactions[reaction] = this.comment.reactions[reaction].filter(userId => userId !== session.info.userId)
      this.requestUpdate()
      await session.ctzn.user.table('ctzn.network/reaction').delete(`${reaction}:${this.comment.url}`)
    } else {
      this.comment.reactions[reaction] = (this.comment.reactions[reaction] || []).concat([session.info.userId])
      this.requestUpdate()
      await session.ctzn.user.table('ctzn.network/reaction').create({
        subject: {dbUrl: this.comment.url, authorId: this.comment.author.userId},
        reaction
      })
    }
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
    this.isReactionsOpen = false
    await session.ctzn.user.table('ctzn.network/reaction').create({
      subject: {dbUrl: this.comment.url, authorId: this.comment.author.userId},
      reaction
    })
    this.comment.reactions[reaction] = (this.comment.reactions[reaction] || []).concat([session.info.userId])
    this.requestUpdate()
    this.reloadSignals()
  }

  async onClickGiftItem () {
    await TransferItemRelatedPopup.create({
      communityId: this.communityUserId,
      subject: this.comment
    })
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
        session.ctzn.view(
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

  onClickViewGifts (e) {
    RelatedItemTransfersListPopup.create({
      communityId: this.communityUserId,
      relatedItemTransfers: this.comment.relatedItemTransfers
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