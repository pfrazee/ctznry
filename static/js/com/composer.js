/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'
import * as contextMenu from './context-menu.js'
import * as displayNames from '../lib/display-names.js'

const CHAR_LIMIT = 256

class Composer extends LitElement {
  static get properties () {
    return {
      nocancel: {type: Boolean},
      autofocus: {type: Boolean},
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
    this.nocancel = false
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

  get canChangeCommunity () {
    return !this.subject && !this.parent
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
        <div class="mb-2">
          <textarea
            class="pt-2 px-3 w-full box-border resize-none outline-none mh-16 text-base"
            placeholder=${this.placeholder}
            @keyup=${this.onTextareaKeyup}
          ></textarea>
        </div>

        <div class="flex justify-between">
          <div class="">
            <span class="px-4 ${this.charLimitClass}">
              ${this.draftText.length > 0 ? `${this.draftText.length} / ${CHAR_LIMIT}` : ''}
            </span>
          </div>
          <div>
            ${this.nocancel ? '' : html`<button
              class="inline-block rounded px-3 py-1 text-gray-500 bg-white hover:bg-gray-100"
              @click=${this.onCancel}
              tabindex="4"
            >Cancel</button>`}
            ${this.canChangeCommunity ? html`
              <button
                class="inline-flex items-center rounded px-3 py-1 shadow-sm text-white ${this.canPost ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-default'}"
                @click=${this.onClickPostTo}
                ?disabled=${!this.canPost}
              >
                Post to
                <span class="fas fa-caret-down ml-1"></span>
              </button>
            ` : html`
              <button
                type="submit"
                class="inline-block rounded px-3 py-1 shadow-sm text-white ${this.canPost ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-default'}"
                tabindex="3"
                ?disabled=${!this.canPost}
              >Post</button>
            `}
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
    this.querySelector('textarea').value = ''
    this.dispatchEvent(new CustomEvent('publish', {detail: res}))
  }
}

customElements.define('ctzn-composer', Composer)
