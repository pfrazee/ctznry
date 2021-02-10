/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { ifDefined } from '../../vendor/lit-element/lit-html/directives/if-defined.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'
import * as contextMenu from './context-menu.js'
import css from '../../css/com/composer.css.js'

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

  static get styles () {
    return css
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
    return this.community ? html`<span class="fas fa-fw fa-users"></span>` : html`<span class="fas fa-fw fa-user"></span>`
  }

  get canChangeCommunity () {
    return !this.subject && !this.parent
  }

  firstUpdated () {
    this.shadowRoot.querySelector('textarea').focus()
  }

  get charLimitDanger () {
    if (this.draftText.length > CHAR_LIMIT) {
      return 'over'
    }
    if (this.draftText.length > CHAR_LIMIT - 50) {
      return 'close'
    }
    return 'fine'
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href=${(new URL('../../css/fontawesome.css', import.meta.url)).toString()}>
      <link rel="stylesheet" href=${(new URL('../vs/editor/editor.main.css', import.meta.url)).toString()}>
      <form @submit=${this.onSubmit}>
        <div class="editor">
          <textarea placeholder=${this.placeholder} @keyup=${this.onTextareaKeyup}></textarea>
        </div>

        <div class="actions">
          <div class="ctrls">
            <span class="char-limit ${this.charLimitDanger}">
              ${this.draftText.length} / ${CHAR_LIMIT}
            </span>
          </div>
          <div>
            <button @click=${this.onCancel} tabindex="4">Cancel</button>
            <button
              class="community"
              @click=${this.onClickSelectCommunity}
              data-tooltip=${ifDefined(!this.canChangeCommunity ? 'Must reply in the same community as the original post' : undefined)}
              ?disabled=${!this.canChangeCommunity}
            >
              Post to: ${this.communityIcon} <span>${this.communityName}</span>
              <span class="fas fa-caret-down"></span>
            </button>
            <button type="submit" class="primary" tabindex="3" ?disabled=${!this.canPost}>
              Post
            </button>
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
