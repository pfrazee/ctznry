/* globals beaker */
import { html } from '../../../vendor/lit-element/lit-element.js'
import { repeat } from '../../../vendor/lit-element/lit-html/directives/repeat.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import * as toast from '../toast.js'
import '../button.js'

// exported api
// =

export class TransferItemPopup extends BasePopup {
  static get properties () {
    return {
      communityId: {type: String},
      item: {type: Object},
      members: {type: Array},
      isProcessing: {type: Boolean},
      currentError: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.communityId = opts.communityId
    this.item = opts.item
    this.members = opts.members
    this.isProcessing = false
    this.currentError = undefined
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return false
  }

  get shouldCloseOnOuterClick () {
    return false
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(TransferItemPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('transfer-item-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl py-4">Transfer ${this.item.value.classId}</h2>

        <label class="block font-semibold p-1" for="recp-input">Recipient</label>
        <div class="relative">
          <select
            type="text"
            id="recp-input"
            name="recp"
            value="${this.communityId}"
            class="block box-border w-full border border-gray-300 rounded p-3 mb-2 appearance-none"
          >
            <option value=${this.communityId}>${this.communityId}</option>
            ${repeat(this.members, member => html`<option value=${member.value.user.userId}>${member.value.user.userId}</option>`)}
          </select>
          <span class="fas fa-caret-down absolute z-10" style="right: 15px; top: 15px"></span>
        </div>
        <label class="block font-semibold p-1" for="keyTemplate-input">Quantity</label>
        <input
          required
          type="text"
          id="qty-input"
          name="qty"
          value="1"
          class="block box-border w-full border border-gray-300 rounded p-3 mb-2"
        />

        <details>
          <summary>Item details:</summary>
          <div class="bg-gray-50 rounded p-2 text-sm text-gray-600 font-mono whitespace-pre overflow-x-auto">${JSON.stringify(this.item, null, 2)}</div>
        </details>

        ${this.currentError ? html`
          <div class="bg-red-100 px-6 py-4 mb-4 text-red-600">${this.currentError}</div>
        ` : ''}

        <div class="flex border-t border-gray-200 mt-4 pt-4">
          <ctzn-button
            btn-class="px-3 py-1"
            @click=${this.onReject}
            label="Cancel"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
          ></ctzn-button>
          <span class="flex-1"></span>
          <ctzn-button
            primary
            btn-type="submit"
            btn-class="px-3 py-1"
            label="Transfer"
            ?disabled=${this.isProcessing}
            ?spinner=${this.isProcessing}
          ></ctzn-button>
        </div>
      </form>
    `
  }

  // events
  // =

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    this.isProcessing = true
    this.currentError = undefined

    const formData = new FormData(e.currentTarget)
    const value = Object.fromEntries(formData.entries())

    const qty = +value.qty
    if (qty != value.qty || qty < 1) {
      this.currentError = `Quantity must be a number greater than zero`
      this.isProcessing = false
      return
    }

    if (value.recp === this.item.value.owner.userId) {
      this.currentError = `${value.recp} is already the owner`
      this.isProcessing = false
      return
    }

    let recp
    try {
      recp = await session.ctzn.lookupUser(value.recp)
      if (!recp.userId || !recp.dbUrl) throw new Error('webfinger lookup failed')
    } catch (e) {
      this.currentError = `Failed to lookup recp details: ${e.toString()}`
      this.isProcessing = false
      return
    }
    
    try {
      await session.ctzn.db(this.communityId).method('ctzn.network/transfer-item-method', {
        itemKey: this.item.key,
        qty,
        recp
      })
    } catch (e) {
      this.currentError = e.message || e.data || e.toString()
      this.isProcessing = false
      return
    }
    this.dispatchEvent(new CustomEvent('resolve'))
  }
}

customElements.define('transfer-item-popup', TransferItemPopup)