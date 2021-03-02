import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { repeat } from '../vendor/lit-element/lit-html/directives/repeat.js'
import * as toast from './com/toast.js'
import * as session from './lib/session.js'
import { AVATAR_URL } from './lib/const.js'
import { getProfile, listMemberships } from './lib/getters.js'
import * as displayNames from './lib/display-names.js'
import * as history from './lib/history.js'
import './com/header.js'
import './com/button.js'
import './com/login.js'
import './com/feed.js'
import './com/img-fallbacks.js'

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
    history.setup()
    this.isLoading = true
    this.isEmpty = false
    this.memberships = undefined
    this.suggestedCommunities = undefined

    this.load()
  }

  async load () {
    await session.setup()
    this.isLoading = false
    if (session.isActive()) {
      this.memberships = await listMemberships(session.info.userId)
      this.memberships.sort((a, b) => a.value.community.userId.localeCompare(b.value.community.userId))
      if (!this.suggestedCommunities) {
        this.suggestedCommunities = SUGGESTED_COMMUNITIES.filter(c => !this.memberships?.find(m => c.userId === m.value.community.userId))
        this.suggestedCommunities = this.suggestedCommunities.sort(() => Math.random() - 0.5)
      }

      for (let membership of this.memberships) {
        membership.communityProfile = await getProfile(membership.value.community.userId)
        this.requestUpdate()
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
    if (this.isLoading) {
      return this.renderLoading()
    }
    return html`
      <ctzn-header @post-created=${e => this.load()}></ctzn-header>
      <main>
        <div class="pb-16">
          ${session.isActive() ? html`
            <div class="border border-gray-200 border-t-0 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
              My Communities
            </div>
            <div class="bg-white mb-4">
              ${this.memberships?.length ? html`
                ${repeat(this.memberships, membership => html`
                  <a
                    class="flex border border-gray-200 border-t-0 px-4 py-4 hover:pointer hover:bg-gray-50"
                    href="/${membership.value.community.userId}"
                    title="${membership.value.community.userId}"
                  >
                    <img class="block rounded-full w-10 h-10 mr-4" src=${AVATAR_URL(membership.value.community.userId)}>
                    <span class="flex-1 min-w-0">
                      <span class="block font-medium">${displayNames.render(membership.value.community.userId)}</span>
                      ${membership.communityProfile?.value?.description ? html`
                        <div class="text-gray-600">${membership.communityProfile.value.description}</div>
                      ` : ''}
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
            <div class="border border-gray-200 text-xl font-semibold px-4 py-2 sticky top-0 z-10 bg-white">
              Suggested Communities
            </div>
            ${repeat(this.suggestedCommunities, community => community.userId, community => {
              const hasJoined = this.memberships?.find(m => community.userId === m.value.community.userId)
              return html`
                <div class="flex bg-white border border-gray-200 border-t-0 px-4 py-3">
                  <img class="block rounded-full w-10 h-10 mr-4" src=${AVATAR_URL(community.userId)}>
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

  renderLoading () {
    return html`
      <div class="max-w-4xl mx-auto">
        <div class="py-32 text-center text-gray-400">
          <span class="spinner h-7 w-7"></span>
        </div>
      </div>
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
}

customElements.define('ctzn-communities', CtznCommunities)
