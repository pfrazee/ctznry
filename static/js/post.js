import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import { ViewThreadPopup } from './com/popups/view-thread.js'
import * as toast from './com/toast.js'
import { AVATAR_URL } from './lib/const.js'
import * as session from './lib/session.js'
import { getProfile } from './lib/getters.js'
import { joinPath } from './lib/strings.js'
import './com/header.js'
import './com/button.js'
import './com/thread.js'
import './com/user-list.js'

class CtznPostPage extends LitElement {
  static get properties () {
    return {
      authorProfile: {type: Object},
      subject: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.authorProfile = undefined
    this.subject = undefined

    this.load()
  }

  async load () {
    await session.setup()

    let pathname = window.location.pathname
    let [userId, _, _2, key] = pathname.split('/').filter(Boolean)

    this.authorProfile = await getProfile(userId)
    this.subject = {
      authorId: userId,
      dbUrl: joinPath(this.authorProfile.dbUrl, 'ctzn.network/post', key)
    }
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
      <div>
        <ctzn-user-list cols="1" .ids=${[this.authorProfile.userId]}></ctzn-user-list>
      </div>
    `
  }

  renderCurrentView () {
    if (!this.authorProfile) {
      return this.renderLoading()
    }
    return this.renderThread()
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
      <div class="max-w-4xl mx-auto grid grid-cols-layout-twocol gap-4">
        <div>
          ${this.subject ? html`
            <ctzn-thread
              .subject=${this.subject}
              @load=${this.onLoadThread}
              @view-thread=${this.onViewThread}
            ></ctzn-thread>
          ` : ''}
        </div>
        ${this.renderRightSidebar()}
      </div>
    `
  }

  renderNotFound () {
    return html`
      <div class="bg-gray-100 text-gray-500 py-44 text-center my-5">
        <div class="fas fa-stream text-6xl text-gray-300 mb-8"></div>
        <div>404 Not Found</div>
      </div>
    `
  }

  // events
  // =

  onLoadThread () {
    this.shadowRoot.querySelector('ctzn-thread').scrollHighlightedPostIntoView()
  }

  onViewThread (e) {
    ViewThreadPopup.create({
      subject: e.detail.subject
    })
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-post-page', CtznPostPage)
