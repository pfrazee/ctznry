import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { CreateItemPopup } from './popups/create-item.js'
import { ViewItemPopup } from './popups/view-item.js'
import { ManageItemClasses } from './popups/manage-item-classes.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { AVATAR_URL } from '../lib/const.js'

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
        <div
          class="relative bg-white mb-1 py-5 px-2 sm:rounded text-center"
        >
          <div class="absolute text-2xl" style="top: 10px; left: 10px">
            <span
              class="fas fa-fw fa-angle-left sm:cursor-pointer"
              @click=${this.onClickBack}
            ></span>
          </div>
          <div class="text-center">
            ${this.currentItemClass.value.id === 'paulbucks' ? html`
              <span class="fas fa-fw fa-money-bill text-2xl mb-1 text-green-500"></span>
            ` : this.currentItemClass.value.id === 'ratings' ? html`
              <span class="fas fa-fw fa-chart-line text-2xl mb-1 text-red-500"></span>
            ` : html`
              <span class="fas fa-fw fa-crown text-2xl mb-1 text-yellow-500"></span>
            `}
          </div>
          <div class="text-xl font-medium">${this.currentItemClass.value.id}</div>
          <div class="text-gray-700">
            ${this.currentItemClass.value.id === 'paulbucks' ? 'The most valuable fake currency in the world.' : ''}
            ${this.currentItemClass.value.id === 'ctznpocalypse-survivor' ? 'The mark of a survivor.' : ''}
            ${this.currentItemClass.value.id === 'ratings' ? 'Only go up.' : ''}
          </div>
          ${this.canCreateItem ? html`
            <div class="mt-1">
              <ctzn-button
                btn-class="text-base py-1 rounded-2xl"
                label="Generate"
                @click=${this.onClickGenerateItem}
              ></ctzn-button>
            </div>
            ` : ''}
        </div>
        ${this.renderItems()}
      `
    }
    return this.renderItemClasses()
  }

  renderItemClasses () {
    if (!this.itemClasses) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${this.itemClasses.length === 0 ? html`
        <div class="bg-gray-50 py-24 sm:py-44 text-center">
          <div class="far fa-gem text-6xl text-gray-300 mb-6"></div>
          <div class="mb-6 text-gray-500">This community has no virtual items!</div>
          ${this.canManageItemClasses ? html`
            <ctzn-button
              btn-class="rounded-full"
              label="Create an item class"
              @click=${this.onClickManageItemClasses}
            ></ctzn-button>
          ` : ''}
        </div>
      ` : html`
        <div class="grid grid-2col gap-1 mb-16">
          ${repeat(this.itemClasses, itemClass => {
            return html`
              <div
                class="bg-white flex flex-col justify-center px-6 py-4 sm:cursor-pointer sm:hover:bg-gray-50 sm:rounded sm:text-center"
                @click=${e => this.onClickViewItemClass(e, itemClass)}
              >
                <div class="sm:text-center">
                  ${itemClass.value.id === 'paulbucks' ? html`
                    <span class="fas fa-fw fa-money-bill text-2xl mb-1 text-green-500"></span>
                  ` : itemClass.value.id === 'ratings' ? html`
                    <span class="fas fa-fw fa-chart-line text-2xl mb-1 text-red-500"></span>
                  ` : html`
                    <span class="fas fa-fw fa-crown text-2xl mb-1 text-yellow-500"></span>
                  `}
                </div>
                <div class="text-xl font-medium">${itemClass.value.id}</div>
                <div class="text-gray-700">
                  ${itemClass.value.id === 'paulbucks' ? 'The most valuable fake currency in the world.' : ''}
                  ${itemClass.value.id === 'ctznpocalypse-survivor' ? 'The mark of a survivor.' : ''}
                  ${itemClass.value.id === 'ratings' ? 'Only go up.' : ''}
                </div>
              </div>
            `
          })}
          ${this.canManageItemClasses ? html`
            <div
              class="bg-white flex flex-col justify-center px-6 py-4 sm:cursor-pointer sm:hover:bg-gray-50 sm:rounded sm:text-center"
              @click=${this.onClickManageItemClasses}
            >
              <div class="text-xl font-medium">Manage</div>
              <div class="text-gray-700">Admin tools</div>
            </div>
          ` : ''}
        </div>
      `}
    `
  }

  renderItems () {
    if (!this.items) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${this.currentItems.length === 0 ? html`
        <div class="bg-gray-100 text-gray-500 py-44 text-center">
          <div class="far fa-gem text-6xl text-gray-300 mb-8"></div>
          <div>This community has not issued any ${this.currentItemClass.value.id}!</div>
        </div>
      ` : html`
        <div class="mb-16">
          ${repeat(this.currentItems, item => item.key, item => {
            return html`
              <div
                class="flex items-center px-3 py-3 bg-white mb-0.5 cursor-pointer sm:rounded sm:hover:bg-gray-50"
                @click=${e => this.onClickViewItem(e, item)}
              >
                <img src=${AVATAR_URL(item.value.owner.userId)} class="block rounded w-8 h-8 mr-2">
                <span class="flex-1 truncate">
                  <span>${displayNames.render(item.value.owner.userId)}</span>
                  <span class="hidden text-gray-500 sm:inline">${item.value.owner.userId}</span>
                </span>
                <span class="pr-1">
                  ${item.value.classId === 'paulbucks' ? html`
                    <span class="fas fa-fw fa-money-bill mr-1 text-sm text-green-500"></span>
                  ` : item.value.classId === 'ratings' ? html`
                    <span class="fas fa-fw fa-chart-line mr-1 text-sm text-red-500"></span>
                  ` : html`
                    <span class="fas fa-fw fa-crown mr-1 text-sm text-yellow-500"></span>
                  `}
                  ${item.value.qty}
                </span>
              </div>
            `
          })}
        </div>
      `}
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

  async onClickViewItem (e, item) {
    await ViewItemPopup.create({
      communityId: this.userId,
      item: item,
      members: this.members
    })
    this.load()
  }
}

customElements.define('ctzn-items-list', ItemsList)