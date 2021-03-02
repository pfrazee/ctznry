/* globals beaker monaco */
import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'

class CommentComposer extends LitElement {
  static get properties () {
    return {
      autofocus: {type: Boolean},
      draftText: {type: String},
      placeholder: {type: String},
      community: {type: Object},
      subject: {type: Object},
      parent: {type: Object}
    }
  }

  constructor () {
    super()
    this.autofocus = false
    this.draftText = ''
    this.placeholder = 'Write your comment'
    this.subject = undefined
    this.parent = undefined
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  get canPost () {
    return this.draftText.length > 0
  }

  firstUpdated () {
    if (this.autofocus) {
      this.querySelector('textarea').focus()
    }
  }

  // rendering
  // =

  render () {
    return html`
      <form @submit=${this.onSubmit}>
        <div class="mb-2">
          <textarea
            id="text"
            class="w-full box-border resize-none outline-none h-32 text-base"
            placeholder=${this.placeholder}
            @keyup=${this.onTextareaKeyup}
          ></textarea>
        </div>

        <div class="flex justify-between">
          <button
            class="inline-block rounded px-3 py-1 text-gray-500 bg-white hover:bg-gray-100"
            @click=${this.onCancel}
            tabindex="4"
          >Cancel</button>
          <button
            type="submit"
            class="inline-block rounded px-3 py-1 shadow-sm text-white ${this.canPost ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-default'}"
            tabindex="3"
            ?disabled=${!this.canPost}
          >Post comment</button>
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

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    if (!this.canPost) {
      return
    }

    let res
    try {
      let root = this.subject || this.parent
      let reply = {
        root,
        parent: undefined
      }
      if (this.parent && this.parent.dbUrl !== root.dbUrl) {
        reply.parent = this.parent
      }
      res = await session.api.comments.create({
        text: this.querySelector('#text').value,
        reply,
        community: this.community
      })
      console.log(res)
    } catch (e) {
      toast.create(e.message, 'error')
      return
    }
    
    this.draftText = ''
    this.querySelector('textarea').value = ''
    this.dispatchEvent(new CustomEvent('publish', {detail: res}))
  }
}

customElements.define('ctzn-comment-composer', CommentComposer)
