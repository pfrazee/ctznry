import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { ViewItemPopup } from './popups/view-item.js'
import { ManageItemClasses } from './popups/manage-item-classes.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import { AVATAR_URL } from '../lib/const.js'

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
    this.userId = undefined
    this.ownedItems = undefined
    this.databaseItems = undefined
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

  // rendering
  // =

  render () {
    if (!this.databaseItems) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${this.databaseItems.length === 0 ? html`
        <div class="bg-gray-50 text-gray-500 py-24 text-center">
          <div class="far fa-gem text-6xl text-gray-300 mb-8"></div>
          <div>${displayNames.render(this.userId)}'s inventory is empty.</div>
        </div>
      ` : html`
        <div class="mb-16">
          ${repeat(this.databaseItems, community => community.databaseId, database => html`
            <div class="px-2 pt-3 pb-1">
              <a href="/${database.databaseId}" class="sm:hover:underline">
                <span class="font-medium">${displayNames.render(database.databaseId)}</span>
                <span class="text-sm text-gray-600">${database.databaseId}</span>
              </a>
            </div>
            ${repeat(database.items, item => item.key, item => html`
              <div
                class="flex items-center px-3 py-3 bg-white mb-0.5 cursor-pointer sm:rounded sm:hover:bg-gray-50"
                @click=${e => this.onClickViewItem(e, item)}
              >
                <span class="mr-1">
                  ${item.value.classId === 'paulbucks' ? html`
                    <span class="fas fa-fw fa-money-bill mr-1 text-sm text-green-500"></span>
                  ` : item.value.classId === 'ratings' ? html`
                    <span class="fas fa-fw fa-chart-line mr-1 text-sm text-red-500"></span>
                  ` : html`
                    <span class="fas fa-fw fa-crown mr-1 text-sm text-yellow-500"></span>
                  `}
                </span>
                <span class="flex-1 truncate">
                  ${item.value.classId}
                </span>
                <span class="px-1">
                  ${item.value.qty}
                </span>
              </div>
            `)}
          `)}
        </div>
      `}
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