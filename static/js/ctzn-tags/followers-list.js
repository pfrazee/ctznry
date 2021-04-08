import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { intersect } from '../lib/functions.js'
import * as session from '../lib/session.js'
import '../com/simple-user-list.js'

export class FollowersList extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      followers: {type: Array},
      sharedFollowers: {type: Array},
      isExpanded: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
    this.view = undefined
    this.userId = undefined
    this.followers = undefined
    this.sharedFollowers = undefined
    this.isExpanded = false
  }

  setContextState (state) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('userId') && this.userId !== changedProperties.get('userId')) {
      this.load()
    }
  }

  async load () {
    this.isExpanded = false
    this.followers = undefined
    this.sharedFollowers = undefined

    this.followers = await session.ctzn.listFollowers(this.userId)
    if (session.isActive() && this.userId !== session.info.userId) {
      this.sharedFollowers = intersect(session.myFollowing, this.followers)
    }
  }

  // rendering
  // =

  render () {
    if (typeof this.followers === 'undefined') {
      return html`
        <div class="bg-white sm:rounded my-1 px-5 py-3">
          <span class="text-lg font-medium mr-1">Followers</span>
          <span class="spinner text-gray-500"></span>
        </div>
      `
    }
    return html`
      <div class="bg-white sm:rounded my-1 ${this.followers ? 'pb-1' : ''}">
        <div
          class="px-5 py-3 sm:rounded ${this.followers?.length ? 'cursor-pointer hov:hover:text-blue-600' : ''}"
          @click=${this.followers?.length ? this.onToggleExpanded : undefined}
        >
          <div class="flex items-center justify-between">
            <span>
              <span class="text-lg font-medium mr-1">Followers</span>
              <span class="text-gray-500 font-bold">${this.followers?.length || '0'}</span>
            </span>
            ${this.followers?.length ? html`
              <span class="fas fa-angle-${this.isExpanded ? 'up' : 'down'}"></span>
            ` : ''}
          </div>
          ${this.sharedFollowers?.length ? html`
            <div class="pt-1 flex items-center text-gray-500">
              <span class="mr-2">Shared:</span>
              ${repeat(this.sharedFollowers.slice(0, 7), (userId, i) => html`
                <span data-tooltip=${userId}>
                  <img src=${AVATAR_URL(userId)} class="inline-block rounded-md w-7 h-7 mr-1">
                </span>
              `)}
              ${this.sharedFollowers.length > 7 ? html`<span class="font-semibold ml-1">+${this.sharedFollowers.length - 7}` : ''}
            </div>
          ` : ''}
        </div>
        ${this.isExpanded ? html`
          <div class="sm:mx-2 mb-1 sm:rounded px-1 py-1 bg-gray-100">
            <app-simple-user-list .ids=${this.followers} empty-message="${this.userId} has no followers."></app-simple-user-list>
          </div>
        ` : ''}
      </div>
    `
  }

  // events
  // =

  onToggleExpanded (e) {
    this.isExpanded = !this.isExpanded
  }
}

customElements.define('ctzn-followers-list', FollowersList)
