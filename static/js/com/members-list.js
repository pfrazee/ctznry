import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { AVATAR_URL } from '../lib/const.js'
import * as session from '../lib/session.js'
import { emit } from '../lib/dom.js'

export class MembersList extends LitElement {
  static get properties () {
    return {
      members: {type: Array},
      canban: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.members = undefined
    this.canban = false
  }

  // rendering
  // =

  render () {
    if (!this.members) {
      return html`<span class="spinner"></span>`
    }
    return html`
      ${repeat(this.members, member => {
        const userId = member.value.user.userId
        const [username, domain] = userId.split('@')
        return html`
          <div class="flex items-center border-b border-gray-300 px-2 py-2">
            <a class="ml-1 mr-3" href="/${userId}" title=${userId}>
              <img class="block rounded-full w-10 h-10 object-cover shadow-sm" src=${AVATAR_URL(userId)}>
            </a>
            <div class="flex-1">
              <div class="">
                <a class="hover:underline" href="/${userId}" title=${userId}>
                  <span class="font-bold">${username}</span> <span class="text-gray-500">@${domain}</span>
                </a>
              </div>
              <div class="text-sm text-gray-500 font-medium">
                <span class="mr-1">Joined ${(new Date(member.value.joinDate)).toLocaleDateString()}</span>
                ${member.value.roles?.length ? html`
                  ${repeat(member.value.roles, role => html`
                    <span class="font-semibold px-1 rounded shadow-sm text-white text-xs bg-${role === 'admin' ? 'pink-700' : 'indigo-700'}">${role}</span>
                  `)}
                ` : ''}
              </div>
            </div>
            <div>
              ${this.renderControls(member)}
            </div>
          </div>
        `
      })}
    `
  }

  renderControls (member) {
    if (member.value.user.userId === session?.info?.userId) {
      return html`
        <span class="font-semibold px-1 rounded shadow-sm text-sm bg-gray-100">This is you</span>
      `
    }
    if (this.canban) {
      return html`
        <button class="text-sm rounded py-1 px-2 hover:bg-gray-50" @click=${e => this.onClickBan(e, member)}>
          <span class="fas fa-fw fa-ban"></span>
          Ban
        </button>
      `
    }
    return ''
  }

  // events
  // =

  async onClickBan (e, member) {
    e.preventDefault()
    emit(this, 'ban', {detail: {userId: member.value.user.userId}})
  }
}

customElements.define('ctzn-members-list', MembersList)

function getUniqFollowers (followers) {
  return [...new Set(followers.community.concat(followers.myCommunity).concat(followers.myFollowed))]
}