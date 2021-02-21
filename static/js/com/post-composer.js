/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'
import * as contextMenu from './context-menu.js'
import * as displayNames from '../lib/display-names.js'

const CHAR_LIMIT = 256

class PostComposer extends LitElement {
  static get properties () {
    return {
      isExtendedOpen: {type: Boolean},
      draftText: {type: String, attribute: 'draft-text'},
      community: {type: Object},
    }
  }

  constructor () {
    super()
    this.isExtendedOpen = false
    this.placeholder = 'What\'s new?'
    this.draftText = ''
    this.community = undefined
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  get canPost () {
    return this.draftText.length > 0 && this.draftText.length <= CHAR_LIMIT
  }

  get communityName () {
    return this.community?.userId || 'Self'
  }

  get communityIcon () {
    return this.community ? html`<span class="fas fa-fw fa-users text-sm mx-1"></span>` : html`<span class="fas fa-fw fa-user text-sm ml-1"></span>`
  }

  get communityExplanation () {
    if (this.community) {
      return `The post will show up in the community and anybody in the community can reply.`
    }
    return `The post will be shown to people who follow you, and only people you follow can reply.`
  }

  firstUpdated () {
    if (this.autofocus) {
      this.querySelector('textarea').focus()
    }
  }

  get charLimitClass () {
    if (this.draftText.length > CHAR_LIMIT) {
      return 'font-semibold text-red-600'
    }
    if (this.draftText.length > CHAR_LIMIT - 50) {
      return 'font-semibold text-yellow-500'
    }
    return 'text-gray-500'
  }

  // rendering
  // =

  render () {
    return html`
      <form @submit=${this.onSubmit}>
        <section class="mb-2">
          <div>
            <button
              class="inline-flex items-center rounded px-3 py-1 bg-white border border-gray-300 hover:bg-gray-100"
              @click=${this.onClickSelectCommunity}
            >
              Post to: ${this.communityIcon} ${this.communityName} <span class="fas fa-fw fa-caret-down"></span>
            </button>
          </div>
          <div class="p-1 text-gray-500">
            ${this.communityExplanation}
          </div>
        </section>

        <section class="mb-3">
          <textarea
            id="text"
            class="py-2 px-3 w-full h-20 box-border resize-y text-lg border border-gray-300 rounded"
            placeholder="What's new?"
            @keyup=${this.onTextareaKeyup}
          ></textarea>
          <div>
            <span class="px-2 ${this.charLimitClass}">
              ${this.draftText.length} / ${CHAR_LIMIT}
            </span>
          </div>
        </section>

        <section class="mb-2 border border-gray-300 rounded">
          <label class="block p-2 cursor-pointer hover:bg-gray-100" @click=${this.onToggleExtendedText}>
            <span class="fas fa-fw fa-caret-${this.isExtendedOpen ? 'down' : 'right'}"></span>
            Extended post text
          </label>
          <textarea
            id="extendedText"
            class="${this.isExtendedOpen ? '' : 'hidden'} block py-2 px-3 w-full h-48 box-border resize-y text-base border-t border-gray-300"
            placeholder="Add more to your post! This is optional, and there's no character limit."
          ></textarea>
        </section>

        <div class="flex justify-between border-t border-gray-200 mt-4 pt-4">
          <ctzn-button @click=${this.onCancel} tabindex="2" label="Cancel"></ctzn-button>
          <ctzn-button
            primary
            type="submit"
            ?disabled=${!this.canPost}
            tabindex="1"
            label="Create Post"
          ></ctzn-button>
        </div>
      </form>
    `
  }
  
  // events
  // =

  onTextareaKeyup (e) {
    this.draftText = e.currentTarget.value
  }

  onToggleExtendedText (e) {
    this.isExtendedOpen = !this.isExtendedOpen
  }

  onCancel (e) {
    e.preventDefault()
    e.stopPropagation()
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('cancel'))
  }

  onClickSelectCommunity (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.left,
      y: rect.bottom,
      roomy: true,
      items: [
        {
          icon: 'fas fa-fw fa-user',
          label: 'Self',
          click: async () => {
            this.community = undefined
          }
        }
      ].concat(session.myCommunities.map(community => ({
        icon: 'fas fa-fw fa-users',
        label: community.userId,
        click: async () => {
          this.community = community
        }
      })))
    })
  }

  onClickPostTo (e) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getClientRects()[0]
    contextMenu.create({
      x: rect.right,
      y: rect.bottom,
      right: true,
      roomy: true,
      items: [
        {
          icon: 'fas fa-fw fa-user',
          label: 'Self',
          click: async () => {
            this.community = undefined
            this.onSubmit()
          }
        }
      ].concat(session.myCommunities.map(community => ({
        icon: 'fas fa-fw fa-users',
        label: displayNames.render(community.userId),
        click: async () => {
          this.community = community
          this.onSubmit()
        }
      })))
    })
  }

  async onSubmit (e) {
    e?.preventDefault()
    e?.stopPropagation()

    if (!this.canPost) {
      return
    }

    let res
    try {
      let text = this.querySelector('#text').value
      let extendedText = this.querySelector('#extendedText').value
      res = await session.api.posts.create({
        text,
        extendedText,
        community: this.community
      })
    } catch (e) {
      toast.create(e.message, 'error')
      return
    }
    
    this.draftText = ''
    this.dispatchEvent(new CustomEvent('publish', {detail: res}))
  }
}

customElements.define('ctzn-post-composer', PostComposer)
