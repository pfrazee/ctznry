import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { POST_URL, ITEM_CLASS_ICON_URL, FULL_POST_URL, AVATAR_URL, BLOB_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { TransferItemRelatedPopup } from '../com/popups/transfer-item-related.js'
import { ReactionsListPopup } from '../com/popups/reactions-list.js'
import { RelatedItemTransfersListPopup } from '../com/popups/related-item-transfers-list.js'
import { emit } from '../lib/dom.js'
import { makeSafe, linkify, pluralize, parseSrcAttr } from '../lib/strings.js'
import { relativeDate } from '../lib/time.js'
import { emojify } from '../lib/emojify.js'
import { writeToClipboard } from '../lib/clipboard.js'
import * as displayNames from '../lib/display-names.js'
import * as contextMenu from '../com/context-menu.js'
import * as toast from '../com/toast.js'
import '../com/reaction-input.js'

export class PostView extends LitElement {
  static get properties () {
    return {
      mode: {type: String}, // 'full', 'condensed', or 'content-only' (default 'condensed')
      src: {type: String},
      post: {type: Object},
      renderOpts: {type: Object},
      isReactionsOpen: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.mode = 'condensed'
    this.post = undefined
    this.renderOpts = {noclick: false}
    this.isReactionsOpen = false

    // helper state
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  updated (changedProperties) {
    if (changedProperties.has('src') && this.src !== changedProperties.get('src')) {
      this.load()
    }
  }

  async load () {
    this.post = undefined
    const {userId, schemaId, key} = parseSrcAttr(this.src)
    this.post = await session.ctzn.getPost(userId, key).catch(e => ({error: true, message: e.toString()}))
  }

  get showCondensed () {
    return this.mode === 'condensed'
  }

  get showContentOnly () {
    return this.mode === 'content-only'
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

  get hasReactionsOrGifts () {
    return (
      this.post.relatedItemTransfers?.length > 0
      || (this.post.reactions && Object.keys(this.post.reactions).length > 0)
    )
  }

  async reloadSignals () {
    this.post.reactions = (await session.ctzn.view('ctzn.network/reactions-to-view', this.post.url))?.reactions
    if (this.communityUserId) {
      this.post.relatedItemTransfers = (
        await session.ctzn.db(`server@${this.communityUserId.split('@')[1]}`)
          .table('ctzn.network/item-tfx-relation-idx')
          .get(this.post.url)
      )?.value.transfers
    }
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
        <div class="flex items-center bg-gray-50 sm:rounded">
          <div class="text-xl pl-4 py-2 text-gray-500">
            <span class="fas fa-fw fa-exclamation-circle"></span>
          </div>
          <div class="px-4 py-2 min-w-0">
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

    if (this.showContentOnly) {
      return this.renderContentOnly()
    } else if (this.showCondensed) {
      return this.renderCondensed()
    }
    
    return html`
      <div
        class="${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="flex items-center pt-2 px-3 sm:pt-3 sm:px-4">
          <a class="inline-block w-10 h-10 mr-2" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <img
              class="inline-block w-10 h-10 object-cover rounded"
              src=${AVATAR_URL(this.post.author.userId)}
            >
          </a>
          <div class="flex-1">
            <div>
              <a class="hov:hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                <span class="text-black font-bold">${displayNames.render(this.post.author.userId)}</span>
              </a>
            </div>
            <div class="text-sm">
              <a class="text-gray-600 hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                ${relativeDate(this.post.value.createdAt)}
              </a>
              ${this.post.value.community ? html`
                <span class="text-gray-700">
                  in
                  <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold hov:hover:underline">
                    ${displayNames.render(this.communityUserId)}
                  </a>
                </span>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="px-3 py-3 sm:px-4 sm:py-4 min-w-0">
          <div class="whitespace-pre-wrap break-words text-lg leading-tight font-medium text-black mb-1.5">${unsafeHTML(emojify(linkify(makeSafe(this.post.value.text))))}</div>
          ${this.post.value.extendedText ? html`
            <div class="whitespace-pre-wrap break-words leading-snug text-gray-800 my-2">${unsafeHTML(emojify(linkify(makeSafe(this.post.value.extendedText))))}</div>
          ` : ''}
          ${this.renderMedia()}
          ${this.noctrls ? '' : html`
            ${this.hasReactionsOrGifts ? html`
              <div class="my-1.5">
                ${this.renderGiftedItems()}
                ${this.renderReactions()}
              </div>
            ` : ''}
            <div class="flex items-center justify-around text-sm text-gray-600 px-1 pt-1 pr-8 sm:pr-80">
              ${this.renderRepliesCtrl()}
              ${this.renderReactionsBtn()}
              ${this.renderGiftItemBtn()}
              ${this.renderActionsSummary()}
            </div>
            ${this.renderReactionsCtrl()}
          `}
        </div>
      </div>
    `
  }

  renderContentOnly () {
    return html`
      <div
        class="${this.renderOpts.noclick ? '' : 'cursor-pointer'}"
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        ${this.renderPostText()}
        ${this.renderMedia()}
      </div>
    `
  }

  renderCondensed () {
    return html`
      <div
        class="grid grid-post px-1 py-0.5 bg-white mb-0.5 ${this.renderOpts.noclick ? '' : 'cursor-pointer'} text-gray-600"
        @click=${this.onClickCard}
        @mousedown=${this.onMousedownCard}
        @mouseup=${this.onMouseupCard}
        @mousemove=${this.onMousemoveCard}
      >
        <div class="pl-2 pt-2">
          <a class="block" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
            <img
              class="block object-cover rounded-full mt-1 w-11 h-11"
              src=${AVATAR_URL(this.post.author.userId)}
            >
          </a>
        </div>
        <div class="block bg-white min-w-0">
          <div class="${this.showContentOnly ? '' : 'pr-2 py-2'} min-w-0">
            ${this.showContentOnly ? '' : html`
              <div class="pl-1 pr-2.5 text-gray-600 truncate">
                <span class="sm:mr-1 whitespace-nowrap">
                  <a class="hov:hover:underline" href="/${this.post.author.userId}" title=${this.post.author.displayName}>
                    <span class="text-gray-800 font-semibold">${displayNames.render(this.post.author.userId)}</span>
                  </a>
                </span>
                <span class="mr-2 text-sm">
                  <a class="hov:hover:underline" href="${POST_URL(this.post)}" data-tooltip=${(new Date(this.post.value.createdAt)).toLocaleString()}>
                    ${relativeDate(this.post.value.createdAt)}
                  </a>
                  ${this.post.value.community ? html`
                    in
                    <a href="/${this.communityUserId}" class="whitespace-nowrap font-semibold text-gray-700 hov:hover:underline">
                      ${displayNames.render(this.communityUserId)}
                    </a>
                  ` : ''}
                </span>
              </div>
            `}
            ${this.renderPostText()}
            ${this.renderMedia()}
            ${this.showContentOnly ? '' : html`
              ${this.hasReactionsOrGifts ? html`
                <div class="flex items-center my-1.5 mx-0.5 text-gray-500 text-sm truncate">
                  ${this.renderGiftedItems()}
                  ${this.renderReactions()}
                </div>
              ` : ''}
              <div class="flex pl-1 mt-1.5 text-gray-500 text-sm items-center justify-between pr-12 sm:pr-80">
                ${this.renderRepliesCtrl()}
                ${this.renderReactionsBtn()}
                ${this.renderGiftItemBtn()}
                <div>
                  <a class="hov:hover:bg-gray-200 px-1 rounded" @click=${this.onClickMenu}>
                    <span class="fas fa-fw fa-ellipsis-h"></span>
                  </a>
                </div>
              </div>
              ${this.renderReactionsCtrl()}
            `}
          </div>
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
          class="box-border object-cover rounded border border-gray-300 w-full img-sizing-${size}"
          src="${BLOB_URL(this.post.author.userId, (item.blobs.thumb || item.blobs.original).blobName)}"
          alt=${item.caption || 'Image'}
        >
      </div>
    `
    const moreImages = media.length - 4
    return html`
      <div class="flex mt-1 mb-2 ${this.showCondensed ? 'sm:px-1' : ''}">
        ${media.length >= 4 ? html`
          <div class="flex-1 flex flex-col pr-0.5">
            <div class="flex-1 pb-0.5">${img(media[0], 'small')}</div>
            <div class="flex-1 pt-0.5">${img(media[2], 'small')}</div>
          </div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${img(media[1], 'small')}</div>
            <div class="flex-1 pt-0.5 relative">
              ${moreImages > 0 ? html`
                <span
                  class="absolute inline-block font-bold px-2 py-0.5 rounded sm:text-lg text-white"
                  style="left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,.85);"
                >+${moreImages}</span>
              ` : ''}
              ${img(media[3], 'small')}
            </div>
          </div>
        ` : media.length === 3 ? html`
          <div class="flex-1 pr-0.5">${img(media[0], 'big')}</div>
          <div class="flex-1 flex flex-col pl-0.5">
            <div class="flex-1 pb-0.5">${img(media[1], 'smaller')}</div>
            <div class="flex-1 pt-0.5">${img(media[2], 'smaller')}</div>
          </div>
        ` : media.length === 2 ? html`
          <div class="flex-1 pr-0.5">${img(media[0], 'medium')}</div>
          <div class="flex-1 pl-0.5">${img(media[1], 'medium')}</div>
        ` : html`
          <div class="flex-1">${img(media[0], 'big')}</div>
        `}
      </div>
    `
  }
  
  renderActionsSummary () {
    const reactionsCount = this.post.reactions ? Object.values(this.post.reactions).reduce((acc, v) => acc + v.length, 0) : 0
    const giftsCount = this.post.relatedItemTransfers?.length || 0
    let reactionsCls = `inline-block ml-1 rounded text-gray-500 ${reactionsCount ? 'cursor-pointer hov:hover:underline' : ''}`
    return html`
      <a class=${reactionsCls} @click=${reactionsCount ? this.onClickViewReactions : undefined}>
        ${reactionsCount} ${pluralize(reactionsCount, 'reaction')}${giftsCount > 0 ? ', ' : ''}
      </a>
      ${giftsCount > 0 ? html`
        <a class="inline-block rounded text-gray-500 cursor-pointer hov:hover:underline" @click=${this.onClickViewGifts}>
          ${giftsCount} ${pluralize(giftsCount, 'gift')}
        </a>
      ` : ''}
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
      <span class=${aCls}>
        <span class="far fa-comment"></span>
        ${this.replyCount}
      </span>
    `
  }

  renderReactionsBtn () {
    let aCls = `inline-block ml-1 mr-6 rounded`
    if (this.canInteract) {
      aCls += ` text-gray-500 hov:hover:bg-gray-200`
    } else {
      aCls += ` text-gray-400`
    }
    return html`
      <a class=${aCls} @click=${e => {this.isReactionsOpen = !this.isReactionsOpen}}>
        <span class="fas fa-fw fa-${this.isReactionsOpen ? 'minus' : 'plus'}"></span>
      </a>
    `
  }

  renderGiftItemBtn () {
    let aCls = `inline-block ml-1 mr-6 px-1 rounded`
    if (this.communityUserId && this.canInteract && !this.isMyPost) {
      return html`
        <a class="${aCls} text-gray-500 hov:hover:bg-gray-200" @click=${this.onClickGiftItem}>
          <span class="fas fa-fw fa-gift"></span>
        </a>
      `
    } else {
      const tooltip = this.isMyPost
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

  renderReactionsCtrl () {
    if (!this.isReactionsOpen) {
      return ''
    }
    return html`
      <app-reaction-input
        .reactions=${this.post.reactions}
        @toggle-reaction=${this.onToggleReaction}
      ></app-reaction-input>
    `
  }

  renderGiftedItems () {
    if (!this.post.relatedItemTransfers?.length) {
      return ''
    }
    return html`
      ${repeat(this.post.relatedItemTransfers, item => html`
        <span
          class="flex-shrink-0 inline-flex items-center border border-gray-300 px-1 py-0.5 rounded mr-1.5 text-sm font-semibold"
        >
          <img
            class="block w-4 h-4 object-cover mr-1"
            src=${ITEM_CLASS_ICON_URL(this.communityUserId, item.itemClassId)}
          >
          ${item.qty}
        </span>
      `)}
    `
  }

  renderReactions () {
    if (!this.post.reactions || !Object.keys(this.post.reactions).length) {
      return ''
    }
    return html`
      ${repeat(Object.entries(this.post.reactions), ([reaction, userIds]) => {
        const colors = this.haveIReacted(reaction) ? 'bg-blue-50 hov:hover:bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 hov:hover:bg-gray-200'
        return html`
          <a
            class="inline-block mr-2 px-1.5 py-0.5 rounded text-sm flex-shrink-0 ${colors}"
            @click=${e => this.onClickReaction(e, reaction)}
          >${unsafeHTML(emojify(makeSafe(reaction)))} <sup class="font-medium">${userIds.length}</sup></a>
        `
      })}
    `
  }

  renderPostText () {
    const {text, extendedText} = this.post.value
    if (!text?.trim() && !extendedText?.trim()) {
      return ''
    }
    return html`
      <div
        class="whitespace-pre-wrap break-words text-black ${this.showContentOnly ? '' : 'mt-1 mb-2 ml-1 mr-2.5'}"
        style="font-size: 16px; letter-spacing: 0.1px; line-height: 1.3;"
      >${unsafeHTML(linkify(emojify(makeSafe(this.post.value.text))))}${this.post.value.extendedText
          ? html`<span class="bg-gray-200 ml-1 px-1 rounded text-gray-600 text-xs">more</span>`
          : ''
      }</div>
    `
  }

  // events
  // =

  onClickCard (e) {
    if (this.renderOpts.noclick) return
    for (let el of e.composedPath()) {
      if (el.tagName === 'A' || el.tagName === 'APP-COMPOSER' || el.tagName === 'APP-REACTION-INPUT') return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  onMousedownCard (e) {
    if (this.renderOpts.noclick) return
    for (let el of e.composedPath()) {
      if (el.tagName === 'A' || el.tagName === 'APP-COMPOSER' || el.tagName === 'APP-REACTION-INPUT') return
    }
    this.isMouseDown = true
    this.isMouseDragging = false
  }

  onMousemoveCard (e) {
    if (this.renderOpts.noclick) return
    if (this.isMouseDown) {
      this.isMouseDragging = true
    }
  }

  onMouseupCard (e) {
    if (this.renderOpts.noclick) return
    if (!this.isMouseDown) return
    if (!this.isMouseDragging) {
      e.preventDefault()
      e.stopPropagation()
      emit(this, 'view-thread', {detail: {subject: {dbUrl: this.post.url, authorId: this.post.author.userId}}})
    }
    this.isMouseDown = false
    this.isMouseDragging = false
  }

  onToggleReaction (e) {
    this.onClickReaction(e, e.detail.reaction)
  }

  async onClickReaction (e, reaction) {
    e.preventDefault()
    e.stopPropagation()

    this.isReactionsOpen = false
    if (this.haveIReacted(reaction)) {
      this.post.reactions[reaction] = this.post.reactions[reaction].filter(userId => userId !== session.info.userId)
      this.requestUpdate()
      await session.ctzn.user.table('ctzn.network/reaction').delete(`${reaction}:${this.post.url}`)
    } else {
      this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.userId])
      this.requestUpdate()
      await session.ctzn.user.table('ctzn.network/reaction').create({
        subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
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
      subject: {dbUrl: this.post.url, authorId: this.post.author.userId},
      reaction
    })
    this.post.reactions[reaction] = (this.post.reactions[reaction] || []).concat([session.info.userId])
    this.requestUpdate()
    this.reloadSignals()
  }

  async onClickGiftItem () {
    await TransferItemRelatedPopup.create({
      communityId: this.communityUserId,
      subject: this.post
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
        session.ctzn.view(
          'ctzn.network/community-user-permission-view',
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

  onClickViewReactions (e) {
    ReactionsListPopup.create({
      reactions: this.post.reactions
    })
  }

  onClickViewGifts (e) {
    RelatedItemTransfersListPopup.create({
      communityId: this.communityUserId,
      relatedItemTransfers: this.post.relatedItemTransfers
    })
  }
}

customElements.define('ctzn-post-view', PostView)
