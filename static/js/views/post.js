import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import * as toast from '../com/toast.js'
import { getProfile } from '../lib/getters.js'
import { joinPath, ucfirst } from '../lib/strings.js'
import '../com/header.js'
import '../com/button.js'
import '../com/thread.js'
import '../com/user-list.js'

class CtznPostView extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      authorProfile: {type: Object},
      subject: {type: Object},
      loadError: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.authorProfile = undefined
    this.subject = undefined
    this.loadError = undefined
    this.scrollToOnLoad = undefined

    this.load()
  }

  async load () {
    this.scrollToOnLoad = undefined
    let pathname = window.location.pathname
    let [userId, schemaDomain, schemaName, key] = pathname.split('/').filter(Boolean)

    try {
      this.authorProfile = await getProfile(userId)
      this.subject = {
        authorId: userId,
        dbUrl: joinPath(this.authorProfile.dbUrl, schemaDomain, schemaName, key)
      }
    } catch (e) {
      this.loadError = e
    }
    document.title = `${ucfirst(schemaName)} by ${this.authorProfile?.value.displayName || userId} | CTZN`
  }

  updated (changedProperties) {
    if (changedProperties.get('currentPath')) {
      this.load()
    }
  }

  async pageLoadScrollTo (y) {
    await this.requestUpdate()
    this.scrollToOnLoad = y
  }

  // rendering
  // =

  render () {
    return html`
      <ctzn-header></ctzn-header>
      ${this.renderCurrentView()}
    `
  }

  renderRightSidebar () {
    return html`
      <nav>
        <ctzn-user-list cols="1" .ids=${[this.authorProfile.userId]}></ctzn-user-list>
      </nav>
    `
  }

  renderCurrentView () {
    if (this.loadError) {
      return this.renderError()
    }
    if (!this.authorProfile) {
      return this.renderLoading()
    }
    return this.renderThread()
  }

  renderError () {
    return html`
      <div class="text-gray-500 py-44 text-center my-5">
        <div class="fas fa-exclamation-triangle text-6xl text-gray-300 mb-8"></div>
        <div>There was an error while trying to load this content.</div>
        <pre class="py-2">${this.loadError.toString()}</pre>
      </div>
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

  renderThread () {
    return html`
      <main>
        <div class="py-2 min-h-screen bg-white sm:bg-transparent">
          <a @click=${this.onClickBack}>
            <span class="fas fa-arrow-left cursor-pointer fa-arrow-left fas mb-2 ml-3 sm:hover:text-gray-700 text-2xl text-gray-600"></span>
          </a>
          ${this.subject ? html`
            <ctzn-thread
              .subject=${this.subject}
              @load=${this.onLoadThread}
            ></ctzn-thread>
          ` : ''}
        </div>
        ${this.renderRightSidebar()}
      </main>
    `
  }

  renderNotFound () {
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
        <div class="fas fa-exclamation-triangle text-6xl text-gray-300 mb-8"></div>
        <div>404 Not Found</div>
      </div>
    `
  }

  // events
  // =

  onLoadThread () {
    if (this.scrollToOnLoad) {
      window.scrollTo(0, this.scrollToOnLoad)
    } else {
      this.querySelector('ctzn-thread').scrollHighlightedPostIntoView()
    }
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
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

customElements.define('ctzn-post-view', CtznPostView)
