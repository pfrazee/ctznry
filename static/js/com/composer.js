/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'
import * as contextMenu from './context-menu.js'

const CHAR_LIMIT = 256

class Composer extends LitElement {
  static get properties () {
    return {
      placeholder: {type: String},
      draftText: {type: String, attribute: 'draft-text'},
      _community: {type: Object},
      subject: {type: Object},
      parent: {type: Object},
      _visibility: {type: String}
    }
  }

  constructor () {
    super()
    this.placeholder = 'What\'s new?'
    this.draftText = ''
    this._community = undefined
    this.subject = undefined
    this.parent = undefined
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  get canPost () {
    return this.draftText.length > 0 && this.draftText.length <= CHAR_LIMIT
  }

  get community () {
    if (this.subject) {
      return this.subject.community
    }
    return this._community
  }

  set community (v) {
    if (this.canChangeCommunity) {
      this._community = v
    }
  }

  get communityName () {
    return this.community?.userId || 'Self'
  }

  get communityIcon () {
    return this.community ? html`<span class="fas fa-fw fa-users ml-1"></span>` : html`<span class="fas fa-fw fa-user ml-1"></span>`
  }

  get canChangeCommunity () {
    return !this.subject && !this.parent
  }

  firstUpdated () {
    this.querySelector('textarea').focus()
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
        <div class="mb-2">
          <textarea
            class="py-4 px-5 w-full box-border resize-none border border-gray-300 rounded"
            placeholder=${this.placeholder}
            @keyup=${this.onTextareaKeyup}
          ></textarea>
        </div>

        <div class="flex justify-between">
          <div class="">
            <span class="px-4 ${this.charLimitClass}">
              ${this.draftText.length} / ${CHAR_LIMIT}
            </span>
          </div>
          <div>
            <button
              class="inline-block rounded px-3 py-1 shadow-sm bg-white border border-gray-300 hover:bg-gray-100"
              @click=${this.onCancel}
              tabindex="4"
            >Cancel</button>
            ${this.canChangeCommunity ? html`
              <button
                class="inline-flex items-center rounded px-3 py-1 shadow-sm bg-white border border-gray-300 hover:bg-gray-100"
                @click=${this.onClickSelectCommunity}
                ?disabled=${!this.canChangeCommunity}
              >
                Post to: ${this.communityIcon}
                <span class="truncate ml-1" style="max-width: 150px">${this.communityName}</span>
                <span class="fas fa-caret-down ml-1"></span>
              </button>
            ` : ''}
            <button
              type="submit"
              class="inline-block rounded px-3 py-1 shadow-sm bg-blue-600 text-white hover:bg-blue-700"
              tabindex="3"
              ?disabled=${!this.canPost}
            >Post</button>
          </div>
        </div>
      </form>
    `
  }
  
  // events
  // =

  onTextareaKeyup (e) {
    this.draftText = e.currentTarget.value
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

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    if (!this.canPost) {
      return
    }

    let res
    try {
      let reply = undefined
      if (this.subject || this.parent) {
        let root = this.subject || this.parent
        reply = {
          root,
          parent: undefined
        }
        if (this.parent && this.parent.dbUrl !== root.dbUrl) {
          reply.parent = this.parent
        }
      }
      res = await session.api.posts.create({
        text: this.draftText,
        reply,
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

customElements.define('ctzn-composer', Composer)
