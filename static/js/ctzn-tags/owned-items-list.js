import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewItemPopup } from '../com/popups/view-item.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { ITEM_CLASS_ICON_URL } from '../lib/const.js'

export class OwnedItemsList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      ownedItems: {type: Array},
      databaseItems: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.userId = undefined
    this.ownedItems = undefined
    this.databaseItems = undefined
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  async load () {
    this.ownedItems = await session.ctzn.listOwnedItems(this.userId)

    const itemsByCommunity = {}
    for (let item of this.ownedItems) {
      if (!itemsByCommunity[item.databaseId]) {
        itemsByCommunity[item.databaseId]= {
          databaseId: item.databaseId,
          items: []
        }
      }
      itemsByCommunity[item.databaseId].items.push(item)
    }
    this.databaseItems = Object.values(itemsByCommunity)
    console.log('load', this.databaseItems)
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && changedProperties.get('userId') != this.userId) {
      this.load()
    }
  }

  getItemClassName (item) {
    return item.itemClass?.value.displayName || item.value.classId
  }

  // rendering
  // =

  render () {
    if (!this.databaseItems) {
      return html`<span class="spinner"></span>`
    }
    return html`
      <div class="bg-white sm:rounded px-3 py-3">
        <h3 class="text-lg font-medium px-2 pb-1">Owned items</h3>
        ${this.databaseItems.length === 0 ? html`
          <div class="bg-gray-50 text-gray-500 py-12 text-center">
            <div>${displayNames.render(this.userId)}'s inventory is empty.</div>
          </div>
        ` : html`
          <div>
            ${repeat(this.databaseItems, database => database.databaseId, (database, i) => html`
              <div class="px-2 py-1 bg-gray-100 mb-2 rounded">
                <div class="px-1 pb-1 pt-1">
                  <a href="/${database.databaseId}" class="hov:hover:underline">
                    <span class="">${displayNames.render(database.databaseId)}</span>
                    <span class="text-sm text-gray-600">${database.databaseId}</span>
                  </a>
                </div>
                ${repeat(database.items, item => item.key, item => html`
                  <div
                    class="flex items-center px-3 py-3 mb-0.5 bg-white rounded cursor-pointer hov:hover:bg-gray-50"
                    @click=${e => this.onClickViewItem(e, item)}
                  >
                    <span class="mr-2">
                      <img
                        src=${ITEM_CLASS_ICON_URL(database.databaseId, item.value.classId)}
                        class="block w-4 h-4 object-cover"
                      >
                    </span>
                    <span class="flex-1 truncate">
                      ${this.getItemClassName(item)}
                      <span class="text-sm text-gray-600">${item.itemClass?.value.description}</span>
                    </span>
                    <span class="px-1">
                      ${item.value.qty}
                    </span>
                  </div>
                `)}
              </div>
            `)}
          </div>
        `}
      </div>
    `
  }

  // events
  // =

  async onClickViewItem (e, item) {
    await ViewItemPopup.create({
      communityId: item.databaseId,
      item: item
    })
    this.load()
  }
}

customElements.define('ctzn-owned-items-list', OwnedItemsList)