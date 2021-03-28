import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import * as toast from './toast.js'
import './button.js'
import './img-fallbacks.js'

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

export class SuggestionsSidebar extends LitElement {
  static get properties () {
    return {
      suggestedCommunities: {type: Array}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.suggestedCommunities = undefined
    this.load()
  }

  async load () {
    if (!this.suggestedCommunities) {
      if (session.isActive() && session.myCommunities) {
        this.suggestedCommunities = SUGGESTED_COMMUNITIES.filter(c => !session.isInCommunity(c.userId))
        this.suggestedCommunities = this.suggestedCommunities.sort(() => Math.random() - 0.5).slice(0, 8)
      } else {
        session.onSecondaryState(this.load.bind(this))
      }
    }
  }

  // rendering
  // =

  render () {
    return html`
      ${this.suggestedCommunities?.length ? html`
        <section>
          ${repeat(this.suggestedCommunities, community => community.userId, community => {
            const hasJoined = session.isInCommunity(community.userId)
            return html`
              <div class="text-sm bg-white mb-2 px-2 py-2 rounded-lg">
                <div>
                  <a class="text-sm hover:pointer hover:underline" href="/${community.userId}" title=${community.displayName}>
                  ${community.displayName}
                  </a>
                </div>
                <div class="text-gray-600 mb-1">${community.description}</div>
                <div>
                  ${hasJoined ? html`
                    <button
                      class="border border-blue-400 px-4 py-0.5 rounded-2xl text-blue-600 text-sm cursor-default"
                      disabled
                    >Joined!</button>
                  ` : html`
                    <button
                      class="border border-blue-400 hover:bg-gray-100 hover:pointer px-4 py-0.5 rounded-2xl text-blue-600 text-sm"
                      @click=${e => this.onClickJoinSuggestedCommunity(e, community)}
                      ?disabled=${hasJoined}
                    >${community.isJoining ? html`<span class="spinner"></span>` : 'Join'}</button>
                  `}
                </div>
              </div>
            `
          })}
        </section>
      ` : ''}
      <section class="sticky top-0 py-2">
        <div class="text-sm bg-white p-3 rounded-lg mb-2">
          <div class="text-lg font-medium">
            <span class="fas fa-heart fa-fw mr-1"></span> Support CTZN!
          </div>
          <div>
            CTZN is donation-driven software. Help us develop this network by joining our patreon.
            <a
              class="block text-center py-1 mt-2 rounded border border-blue-500 text-blue-600 hover:bg-gray-50"
              href="https://patreon.com/paul_maf_and_andrew"
              target="_blank"
            >Join our Patreon</a>            
          </div>
        </div>
        <div class="text-sm bg-white p-3 rounded-lg">
          <div class="text-lg font-medium">
            <span class="fas fa-video fa-fw mr-1"></span> Watch the dev stream
          </div>
          <div>
            Follow CTZN's development by joining the daily livestream by the core team every weekday.
            <a
              class="block text-center py-1 mt-2 rounded border border-blue-500 text-blue-600 hover:bg-gray-50"
              href="https://www.youtube.com/channel/UCSkcL4my2wgDRFvjQOJzrlg"
              target="_blank"
            >Subscribe on YouTube</a>
            <a 
              class="block text-center py-1 mt-2 rounded border border-blue-500 text-blue-600 hover:bg-gray-50"
              href="https://ctzn.network/dev-vlog"
              target="_blank"
            >Watch the archives</a>
          </div>
        </div>
      </section>
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

customElements.define('ctzn-suggestions-sidebar', SuggestionsSidebar)
