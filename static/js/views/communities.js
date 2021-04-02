import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as toast from '../com/toast.js'
import * as session from '../lib/session.js'
import { AVATAR_URL } from '../lib/const.js'
import * as displayNames from '../lib/display-names.js'
import '../com/header.js'

const SUGGESTED_COMMUNITIES = [
  {
    userId: 'alphatesters@ctzn.one',
    displayName: 'CTZN Alpha Testers',
    description: 'Find other CTZN alpha users and talk about what\'s going on with the network.'
  },
  {
    userId: 'welcome@ctzn.one',
    displayName: 'Welcome to CTZN',
    description: 'A place for new users to ask questions!'
  },
  {
    userId: 'ktzns@ctzn.one',
    displayName: 'KTZNs',
    description: 'A community for cat lovers.'
  },
  {
    userId: 'quotes@ctzn.one',
    displayName: 'Quotes',
    description: 'Share the wisdom, or lack thereof.'
  },
  {
    userId: 'gameboard@ctzn.one',
    displayName: 'Boardgames',
    description: 'A place to share what you\'ve been playing.'
  },
  {
    userId: 'P2P@ctzn.one',
    displayName: 'P2P',
    description: 'A place to chat about P2P, Federated, and Decentralised Systems!'
  },
  {
    userId: 'mlai@ctzn.one',
    displayName: 'Machine Learning & artificial intelligence',
    description: 'A space for ML & AI discussions.'
  },
  {
    userId: 'rustaceans@ctzn.one',
    displayName: 'Rustaceans',
    description: 'Rustaceans are people who use Rust, contribute to Rust, or are interested in the development of Rust.'
  },
  {
    userId: 'python@ctzn.one',
    displayName: 'Python',
    description: 'Python programming language'
  },
  {
    userId: 'GeminiEnthusiasts@ctzn.one',
    displayName: 'Gemini Protocol Enthusiasts',
    description: 'Community for people who love the Gemeni protocol.'
  },
  {
    userId: 'sports@ctzn.one',
    displayName: 'Sports',
    description: 'A place all around sports.'
  },
  {
    userId: 'Hamradio@ctzn.one',
    displayName: 'Hamradio',
    description: 'Hamradio Community'
  }
]

class CtznCommunities extends LitElement {
  static get properties () {
    return {
      searchQuery: {type: String},
      isEmpty: {type: Boolean},
      memberships: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isEmpty = false
    this.memberships = undefined
    this.suggestedCommunities = undefined

    this.load()
  }

  async load () {
    document.title = `Communities | CTZN`
    if (session.isActive()) {
      this.memberships = await session.ctzn.user.table('ctzn.network/community-membership').list()
      this.memberships.sort((a, b) => a.value.community.userId.localeCompare(b.value.community.userId))
      if (!this.suggestedCommunities) {
        this.suggestedCommunities = SUGGESTED_COMMUNITIES.filter(c => !this.memberships?.find(m => c.userId === m.value.community.userId))
        this.suggestedCommunities = this.suggestedCommunities.sort(() => Math.random() - 0.5)
      }
    } else {
      this.memberships = []
      this.suggestedCommunities = SUGGESTED_COMMUNITIES.sort(() => Math.random() - 0.5)
    }
  }

  // rendering
  // =

  render () {
    return html`
      ${this.renderCurrentView()}
    `
  }

  renderCurrentView () {
    return html`
      <ctzn-header current-path=${'/communities'}></ctzn-header>
      <main class="pb-16">
        ${session.isActive() ? html`
          <div>
            <div
              class="sticky top-0 z-10 mb-0.5 px-4 py-3 sm:rounded"
              style="
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                background: rgba(255, 255, 255, 0.9);
              "
            >
              <a @click=${this.onClickBack}>
                <span class="fas fa-angle-left fa-fw cursor-pointer sm:hover:text-gray-700 text-xl text-gray-600"></span>
              </a>
              <span class="ml-2 font-medium text-lg">My Communities</span>
            </div>
            <div class="mb-4">
              ${this.memberships?.length ? html`
                ${repeat(this.memberships, membership => html`
                  <a
                    class="flex items-center bg-white mb-0.5 px-4 py-2 sm:rounded sm:hover:pointer sm:hover:bg-gray-50"
                    href="/${membership.value.community.userId}"
                    title="${membership.value.community.userId}"
                  >
                    <img class="block rounded-lg w-8 h-8 mr-4" src=${AVATAR_URL(membership.value.community.userId)}>
                    <span class="flex-1 min-w-0">
                      <span class="block font-medium">${displayNames.render(membership.value.community.userId)}</span>
                    </span>
                  </a>
                `)}
              ` : html`
                <div class="border border-gray-200 border-t-0 px-4 py-4 text-gray-500 tracking-tight">
                  Join a community to get connected to more people!
                </div>
              `}
            </div>
          ` : ''}
          ${this.suggestedCommunities?.length ? html`
            <div
              class="sticky top-0 z-10 mb-0.5 px-4 py-3 sm:rounded"
              style="
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                background: rgba(255, 255, 255, 0.9);
              "
            >
              <a @click=${this.onClickBack}>
                <span class="fas fa-angle-left fa-fw cursor-pointer sm:hover:text-gray-700 text-xl text-gray-600"></span>
              </a>
              <span class="ml-2 font-medium text-lg">Suggested Communities</span>
            </div>
            ${repeat(this.suggestedCommunities, community => community.userId, community => {
              const hasJoined = this.memberships?.find(m => community.userId === m.value.community.userId)
              return html`
                <div class="flex bg-white px-4 py-3 mb-0.5 sm:rounded">
                  <img class="block rounded-lg w-10 h-10 mr-4" src=${AVATAR_URL(community.userId)}>
                  <div class="flex-1 min-w-0">
                    <div>
                      <a class="font-medium hover:pointer hover:underline" href="/${community.userId}" title=${community.displayName}>
                        ${community.displayName}
                      </a>
                    </div>
                    <div class="text-gray-600 mb-1">${community.description}</div>
                    ${session.isActive() ? html`<div>
                      ${hasJoined ? html`
                        <button
                          class="border border-blue-400 px-6 py-1 rounded-2xl text-blue-600 text-sm cursor-default"
                          disabled
                        >Joined!</button>
                      ` : html`
                        <button
                          class="border border-blue-400 hover:bg-gray-100 hover:pointer px-6 py-1 rounded-2xl text-blue-600 text-sm"
                          @click=${e => this.onClickJoinSuggestedCommunity(e, community)}
                          ?disabled=${hasJoined}
                        >${community.isJoining ? html`<span class="spinner"></span>` : 'Join'}</button>
                      `}
                    </div>` : ''}
                  </div>
                </div>
              `
            })}
          ` : ''}
        </div>
      </main>
    `
  }

  // events
  // =

  async onClickJoinSuggestedCommunity (e, community) {
    community.isJoining = true
    this.requestUpdate()
    try {
      await session.api.communities.join(community.userId)
      await session.loadSecondaryState()
      toast.create('Community joined')
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
    community.isJoining = false
    this.requestUpdate()
    this.load()
  }

  onClickBack (e) {
    e.preventDefault()
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location = '/'
    }
  }
}

customElements.define('ctzn-communities-view', CtznCommunities)
