import { LitElement, html } from '../../vendor/lit/lit.min.js'
import { repeat } from '../../vendor/lit/directives/repeat.js'
import { AVATAR_URL } from '../lib/const.js'
import { emit } from '../lib/dom.js'
import { CreateCommunityPopup } from './popups/create-community.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'

export class SearchableUserList extends LitElement {
  static get properties () {
    return {
      filter: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.filter = ''
  }

  // rendering
  // =

  get hasFilter () {
    return !!this.filter
  }

  testUserId (userId) {
    if (!this.filter) return true
    if (userId.toLowerCase().includes(this.filter)) return true
    if (displayNames.get(userId).toLowerCase().includes(this.filter)) return true
    return false
  }

  getFilteredMe () {
    const userId = session.info.userId
    return this.testUserId(userId) ? userId : undefined
  }

  getFilteredUsers () {
    return (session.myFollowing || []).filter(userId => this.testUserId(userId))
  }

  getFilteredCommunities () {
    return (session.myCommunities || [])
      .map(c => c.userId)
      .filter(userId => this.testUserId(userId))
  }

  render () {
    const me = this.getFilteredMe()
    const users = this.getFilteredUsers()
    const communities = this.getFilteredCommunities()
    return html`
      <div class="flex items-center bg-gray-100 rounded-2xl mb-3 mr-2 px-3 py-1.5 sm:py-0.5">
        <span class="fas fa-search text-sm text-gray-500 mr-2"></span>
        <input
          type="text"
          class="w-full bg-transparent"
          placeholder="Search"
          @keyup=${this.onKeyupFilter}
        >
      </div>
      ${me ? html`
        <a
          class="flex items-center pl-2 pr-4 py-1 text-sm rounded hov:hover:bg-gray-100"
          href="/${me}"
          title=${me}
        >
          <img class="w-8 h-8 object-cover rounded-md mr-2" src=${AVATAR_URL(me)} style="left: 10px; top: 6px">
          ${displayNames.render(me)}
        </a>
      ` : ''}
      ${!this.hasFilter || communities?.length ? html`
        <h3 class="font-bold pl-2 mt-4 text-gray-500 text-xs">
          My Communities
        </h3>
        <div class="mb-4">
          ${communities?.length ? html`
            ${repeat(communities, userId => userId, userId => html`
              <a
                class="flex items-center pl-2 pr-4 py-1 text-sm rounded hov:hover:bg-gray-100"
                href="/${userId}"
              >
                <img
                  class="lazyload w-8 h-8 object-cover rounded-md mr-2"
                  data-src=${AVATAR_URL(userId)}
                >
                <span class="truncate font-medium">${displayNames.render(userId)}</span>
              </a>
            `)}
          ` : html`
            <div class="pl-2 pr-5 mb-1 text-base text-gray-700">
              Join a community to get connected to more people!
            </div>
          `}
          ${!this.hasFilter ? html`
            <a
              class="flex items-center pl-2 pr-4 py-1 text-sm rounded cursor-pointer hov:hover:bg-gray-100"
              @click=${this.onClickCreateCommunity}
            >
              <span
                class="w-8 py-1.5 text-center object-cover rounded-md mr-2 bg-gray-300 text-gray-600"
              ><span class="fas fa-plus"></span></span>
              <span class="truncate font-semibold text-gray-600">Create community</span>
            </a>
            <a
              class="flex items-center pl-2 pr-4 py-1 text-sm rounded cursor-pointer hov:hover:bg-gray-100"
              href="/communities"
            >
              <span
                class="w-8 py-1.5 text-center object-cover rounded-md mr-2 bg-gray-300 text-gray-600"
              ><span class="fas fa-users"></span></span>
              <span class="truncate font-semibold text-gray-600">Browse</span>
            </a>
          ` : ''}
        </div>
      ` : ''}
      ${users?.length ? html`
        <h3 class="font-bold pl-2 mt-4 text-gray-500 text-xs">
          My Follows
        </h3>
        ${repeat(users, f => f, userId => html`
          <a
            class="flex items-center pl-2 pr-4 py-1 text-sm rounded hov:hover:bg-gray-100"
            href="/${userId}"
          >
            <img
              class="lazyload w-8 h-8 object-cover rounded-md mr-2"
              data-src=${AVATAR_URL(userId)}
            >
            <span class="truncate font-medium">${displayNames.render(userId)}</span>
          </a>
        `)}
      ` : ''}
    `
  }

  // events
  // =

  async onClickCreateCommunity (e) {
    e.preventDefault()
    e.stopPropagation()
    this.isMenuOpen = false
    const res = await CreateCommunityPopup.create()
    console.log(res)
    window.location = `/${res.userId}`
  }

  onKeyupFilter (e) {
    this.filter = e.currentTarget.value.toLowerCase()
    if (e.code === 'Enter') {
      emit(this, 'navigate-to', {detail: {url: `/${this.filter}`}})
    }
  }
}

customElements.define('app-searchable-user-list', SearchableUserList)
