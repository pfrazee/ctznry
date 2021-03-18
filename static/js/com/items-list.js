import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { CreateItemPopup } from './popups/create-item.js'
import { TransferItemPopup } from './popups/transfer-item.js'
import { ManageItemClasses } from './popups/manage-item-classes.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'

export class ItemsList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      members: {type: Array},
      currentItemClass: {type: String},
      itemClasses: {type: Array},
      items: {type: Array},
      canManageItemClasses: {type: Boolean},
      canCreateItem: {type: Boolean},
      canTransferUnownedItem: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.members = []
    this.currentItemClass = undefined
    this.itemClasses = undefined
    this.items = undefined
    this.canManageItemClasses = false
    this.canCreateItem = false
    this.canTransferUnownedItem = false
  }

  get currentItems () {
    if (this.currentItemClass) {
      return this.items.filter(item => item.value.classId === this.currentItemClass.value.id)
    }
    return this.items
  }

  async load () {
    this.itemClasses = await session.ctzn.db(this.userId).table('ctzn.network/item-class').list()
    console.log(this.itemClasses)
    this.items = await session.ctzn.db(this.userId).table('ctzn.network/item').list()
    console.log(this.items)
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && changedProperties.get('userId') != this.userId) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (this.currentItemClass) {
      return html`
        <div class="flex items-center border-b border-gray-200 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
          <span
            class="fas fa-fw fa-angle-left sm:cursor-pointer"
            @click=${this.onClickBack}
          ></span>
          ${this.currentItemClass.value.id}
          <span class="flex-1"></span>
          ${this.canCreateItem ? html`
            <ctzn-button
              btn-class="text-base py-1 rounded-2xl"
              label="Generate"
              @click=${this.onClickGenerateItem}
            ></ctzn-button>
          ` : ''}
        </div>
        ${this.renderItems()}
      `
    }
    return html`
      <div class="flex items-center border-b border-gray-200 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
        <span>Virtual Items</span>
        <span class="flex-1"></span>
        ${this.canManageItemClasses ? html`
          <ctzn-button
            btn-class="text-base py-1 rounded-2xl"
            label="Manage"
            @click=${this.onClickManageItemClasses}
          ></ctzn-button>
        ` : ''}
      </div>
      ${this.renderItemClasses()}
    `
  }

  renderItemClasses () {
    if (!this.itemClasses) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${this.itemClasses.length === 0 ? html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center border-b border-gray-200">
          <div class="far fa-gem text-6xl text-gray-300 mb-8"></div>
          <div>This community has no virtual items!</div>
        </div>
      ` : ''}
      ${repeat(this.itemClasses, itemClass => {
        return html`
          <div
            class="flex items-center border-b border-gray-200 text-xl px-4 py-3 sm:hover:bg-gray-50 sm:cursor-pointer bg-white"
            @click=${e => this.onClickViewItemClass(e, itemClass)}
          >
            <span>${itemClass.value.id}</span>
            <span class="flex-1"></span>
            <span class="fas fa-fw fa-angle-right"></span>
          </div>
        `
      })}
    `
  }

  renderItems () {
    if (!this.items) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${this.currentItems.length === 0 ? html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center border-b border-gray-200">
          <div class="far fa-gem text-6xl text-gray-300 mb-8"></div>
          <div>This community has not issued any ${this.currentItemClass.value.id}!</div>
        </div>
      ` : html`
        <div class="border-b border-gray-200 px-4 py-3 bg-white">
          <span class="font-semibold">Owner</span>
          <span class="font-semibold float-right">Quantity</span>
        </div>
      `}
      ${repeat(this.currentItems, item => item.key, item => {
        return html`
          <div class="border-b border-gray-200 px-4 py-3 bg-white" id=${item.key}>
            <details>
              <summary>
                <a href="/${item.value.owner.userId}" title=${item.value.owner.userId}>
                  ${displayNames.render(item.value.owner.userId)}
                </a>
                <span class="float-right">${item.value.qty}</span>
              </summary>
              <div class="mt-2 text-gray-600 text-xs">Details</div>
              <div class="bg-gray-50 rounded p-2 text-sm text-gray-600 font-mono whitespace-pre overflow-x-auto">${JSON.stringify(item, null, 2)}</div>
              ${this.canTransferUnownedItem || session.info?.userId === item.value.owner.userId ? html`
                <div class="mt-2">
                  <ctzn-button
                    btn-class="text-base py-1 rounded-2xl"
                    label="Transfer"
                    @click=${e => this.onClickTransferItem(e, item)}
                  ></ctzn-button>
                </div>
              ` : ''}
            </details>
          </div>
        `
      })}
    `
  }

  // events
  // =

  async onClickManageItemClasses () {
    await ManageItemClasses.create({
      communityId: this.userId,
      itemClasses: this.itemClasses
    })
    this.load()
  }

  onClickBack (e) {
    this.currentItemClass = undefined
  }

  onClickViewItemClass (e, itemClass) {
    this.currentItemClass = itemClass
  }

  async onClickGenerateItem (e) {
    await CreateItemPopup.create({
      communityId: this.userId,
      itemClassId: this.currentItemClass.value.id,
      members: this.members
    })
    this.load()
  }

  async onClickTransferItem (e, item) {
    await TransferItemPopup.create({
      communityId: this.userId,
      item: item,
      members: this.members
    })
    this.load()
  }
}

customElements.define('ctzn-items-list', ItemsList)