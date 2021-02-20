import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { listFollows } from '../lib/getters.js'

export class SimpleUserList extends LitElement {
  static get properties () {
    return {
      ids: {type: Array},
      myFollows: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.ids = []
    this.myFollows = []
  }

  async load () {
    if (session.isActive()) {
      this.myFollows = (await listFollows(session.info.userId).catch(e => [])).map(f => f.value.subject.userId)
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('ids') && changedProperties.get('ids') != this.ids) {
      this.load()
    }
  }

  // rendering
  // =

  render () {
    if (!this.ids) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${repeat(this.ids, userId => {
        const [username, domain] = userId.split('@')
        return html`
          <div class="flex items-center border-b border-gray-200 px-2 py-2">
            <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
              <img class="block rounded-full w-10 h-10 object-cover shadow-sm" src=${AVATAR_URL(userId)}>
            </a>
            <div class="flex-1">
              <div class="">
                <a class="hover:underline" href="/${userId}" title=${userId}>
                  <span class="font-bold">${username}</span><span class="text-gray-500">@${domain}</span>
                </a>
              </div>
            </div>
            <div>
              ${this.renderControls(userId)}
            </div>
          </div>
        `
      })}
    `
  }

  renderControls (userId) {
    if (userId === session?.info?.userId) {
      return html`
        <span class="font-semibold px-1 rounded shadow-sm text-sm bg-gray-100">This is you</span>
      `
    }
    if (session.isActive()) {
      return html`
        ${this.myFollows.includes(userId) ? html`
          <ctzn-button btn-class="text-sm font-medium px-4 py-0.5 rounded-full" @click=${e => this.onClickUnfollow(e, userId)} label="Unfollow">
          </ctzn-button>
        ` : html`
          <ctzn-button primary btn-class="text-sm font-medium px-4 py-0.5 rounded-full" @click=${e => this.onClickFollow(e, userId)} label="Follow">
          </ctzn-button>
        `}
      `
    }
    return ''
  }

  // events
  // =

  async onClickFollow (e, userId) {
    e.preventDefault()
    await session.api.follows.follow(userId)
    this.myFollows.push(userId)
    this.requestUpdate()
  }

  async onClickUnfollow (e, userId) {
    e.preventDefault()
    await session.api.follows.unfollow(userId)
    this.myFollows.splice(this.myFollows.indexOf(userId))
    this.requestUpdate()
  }
}

customElements.define('ctzn-simple-user-list', SimpleUserList)

function getUniqFollowers (followers) {
  return [...new Set(followers.community.concat(followers.myCommunity).concat(followers.myFollowed))]
}