import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import * as toast from './com/toast.js'
import { pluralize } from './lib/strings.js'
import { AVATAR_URL } from './lib/const.js'
import * as session from './lib/session.js'
import css from '../css/main.css.js'
import './com/header.js'
import './com/composer.js'
import './com/feed.js'
import './com/img-fallbacks.js'

class CtznApp extends LitElement {
  static get properties () {
    return {
      isComposingPost: {type: Boolean},
      searchQuery: {type: String},
      isEmpty: {type: Boolean},
      numNewItems: {type: Number}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.isComposingPost = false
    this.searchQuery = ''
    this.isEmpty = false
    this.numNewItems = 0
    this.loadTime = Date.now()

    this.load()

    setInterval(this.checkNewItems.bind(this), 5e3)

    window.addEventListener('popstate', (event) => {
      this.configFromQP()
    })
  }

  async load ({clearCurrent} = {clearCurrent: false}) {
    await session.setup()
    if (!session.active) {
      return this.requestUpdate()
    }

    if (this.shadowRoot.querySelector('ctzn-feed')) {
      this.loadTime = Date.now()
      this.numNewItems = 0
      this.shadowRoot.querySelector('ctzn-feed').load({clearCurrent})
    }
    
    if ((new URL(window.location)).searchParams.has('composer')) {
      this.isComposingPost = true
      window.history.replaceState({}, null, '/')
    }
  }

  async checkNewItems () {
    // TODO check for new items
    // var query = PATH_QUERIES[location.pathname.slice(1) || 'all']
    // if (!query) return
    // var {count} = await beaker.index.gql(`
    //   query NewItems ($paths: [String!]!, $loadTime: Long!) {
    //     count: recordCount(
    //       paths: $paths
    //       after: {key: "crtime", value: $loadTime}
    //     )
    //   }
    // `, {paths: query, loadTime: this.loadTime})
    // this.numNewItems = count
  }

  get isLoading () {
    let queryViewEls = Array.from(this.shadowRoot.querySelectorAll('ctzn-feed'))
    return !!queryViewEls.find(el => el.isLoading)
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <ctzn-header></ctzn-header>
        ${this.renderCurrentView()}
      </main>
    `
  }

  renderRightSidebar () {
    return html`
      <div class="sidebar">
        <div class="sticky">
          <div class="search-ctrl">
            <span class="fas fa-search"></span>
            ${!!this.searchQuery ? html`
              <a class="clear-search" @click=${this.onClickClearSearch}><span class="fas fa-times"></span></a>
            ` : ''}
            <input @keyup=${this.onKeyupSearch} placeholder="Search" value=${this.searchQuery}>
          </div>
        </div>
      </div>
    `
  }

  renderCurrentView () {
    if (!session.isActive()) {
      return this.renderNoSession()
    }
    return this.renderWithSession()
  }

  renderNoSession () {
    return html`
      <div class="twocol">
        <div>
          <h1>Welcome to the CTZN network</h1>
          <p>The hottest place to get your memes</p>
        </div>
      </div>
    `
  }

  renderWithSession () {
    return html`
      <div class="twocol">
        <div>
          <div class="composer">
            <img class="thumb" src="${AVATAR_URL(session.info.userId)}">
            ${this.isComposingPost ? html`
              <ctzn-composer
                @publish=${this.onPublishPost}
                @cancel=${this.onCancelPost}
              ></ctzn-composer>
            ` : html`
              <div class="compose-post-prompt" @click=${this.onComposePost}>
                What's new?
              </div>
            `}
          </div>
          ${this.isEmpty ? this.renderEmptyMessage() : ''}
          <div class="reload-page ${this.numNewItems > 0 ? 'visible' : ''}" @click=${e => this.load()}>
            ${this.numNewItems} new ${pluralize(this.numNewItems, 'update')}
          </div>
          <ctzn-feed
            limit="50"
            @load-state-updated=${this.onFeedLoadStateUpdated}
            @view-thread=${this.onViewThread}
            @publish-reply=${this.onPublishReply}
          ></ctzn-feed>
        </div>
        ${this.renderRightSidebar()}
      </div>
    `
  }

  renderEmptyMessage () {
    if (this.searchQuery) {
      return html`
        <div class="empty">
            <div class="fas fa-search"></div>
          <div>No results found for "${this.searchQuery}"</div>
        </div>
      `
    }
    return html`
      <div class="empty">
        <div class="fas fa-stream"></div>
        <div>Subscribe to sites to see what's new</div>
      </div>
    `
  }

  // events
  // =

  onFeedLoadStateUpdated (e) {
    if (typeof e.detail?.isEmpty !== 'undefined') {
      this.isEmpty = e.detail.isEmpty
    }
    this.requestUpdate()
  }

  onKeyupSearch (e) {
    if (e.code === 'Enter') {
      window.location = `/search?q=${e.currentTarget.value.toLowerCase()}`
    }
  }

  onClickClearSearch (e) {
    window.location = '/'
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      subject: e.detail.subject
    })
  }

  onComposePost (e) {
    this.isComposingPost = true
  }

  onCancelPost (e) {
    this.isComposingPost = false
  }

  onPublishPost (e) {
    this.isComposingPost = false
    toast.create('Post published', '', 10e3)
    this.load()
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-app', CtznApp)
