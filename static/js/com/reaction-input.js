import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import { SUGGESTED_REACTIONS } from '../lib/const.js'
import * as session from '../lib/session.js'
import { makeSafe } from '../lib/strings.js'
import { emojify } from '../lib/emojify.js'
import { emit } from '../lib/dom.js'
import './button.js'

export class ReactionInput extends LitElement {
  static get properties () {
    return {
      reactions: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.reactions = undefined
  }

  haveIReacted (reaction) {
    if (!session.isActive()) return
    return this.reactions?.[reaction]?.includes(session.info.userId)
  }

  firstUpdated () {
    this.querySelector('input').focus()
  }

  // rendering
  // =

  render () {
    return html`
      <div class="border border-gray-200 rounded pb-2 px-1 mt-1">
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
              >${unsafeHTML(emojify(makeSafe(reaction)))}</a>
            `
          })}
        </div>
        <form class="flex items-center mt-2 mx-1" @submit=${this.onSubmitCustom}>
          <input
            name="custom"
            type="text"
            class="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-sm"
            placeholder="Enter a custom reaction"
          >
          <ctzn-button
            btn-type="submit"
            btn-class="text-sm py-1 ml-2"
            label="Add"
          ></ctzn-button>
        </form>
      </div>
    `
  }

  // events
  // =

  onClickReaction (e, reaction) {
    emit(this, 'toggle-reaction', {detail: {reaction}})
  }

  onSubmitCustom (e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.custom.value) {
      let reaction = e.currentTarget.custom.value
      reaction = reaction.trim().toLowerCase()
      if (reaction) {
        emit(this, 'toggle-reaction', {detail: {reaction}})
      }
    }
  }
}

customElements.define('ctzn-reaction-input', ReactionInput)
