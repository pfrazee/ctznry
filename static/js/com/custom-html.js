import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { unsafeHTML } from '../../vendor/lit-element/lit-html/directives/unsafe-html.js'
import * as ctznHtml from '../lib/ctzn-html.js'
import * as session from '../lib/session.js'
import { decodeBase64 } from '../lib/strings.js'

import '../ctzn-tags/card.js'
import '../ctzn-tags/code.js'
import '../ctzn-tags/post-view.js'
import '../ctzn-tags/posts-feed.js'
import '../ctzn-tags/followers-list.js'
import '../ctzn-tags/following-list.js'
import '../ctzn-tags/community-memberships-list.js'
import '../ctzn-tags/community-members-list.js'
import '../ctzn-tags/dbmethods-feed.js'
import '../ctzn-tags/owned-items-list.js'
import '../ctzn-tags/item-classes-list.js'

export class CustomHtml extends LitElement {
  static get properties () {
    return {
      context: {type: String},
      contextState: {type: Object},
      userId: {type: String},
      blobName: {type: String},
      html: {type: String},
      loadedHtml: {type: String},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.context = undefined
    this.contextState = {}
    this.userId = undefined
    this.blobName = undefined
    this.html = undefined
    this.loadedHtml = undefined
    this.currentError = undefined
  }
  
  async updated (changedProperties) {
    if (changedProperties.has('userId') || changedProperties.has('blobName') || changedProperties.has('html')) {
      if (this.html || (this.userId && this.blobName)) {
        this.load()
      }
    }
    if (changedProperties.has('loadedHtml')) {  
      await this.updateComplete
      this.htmlChanged()
    }
  }
  
  async load () {
    this.currentError = undefined
    if (this.html) {
      this.loadedHtml = this.html
      return
    }
    try {
      let base64buf = (await session.ctzn.blob.get(this.userId, this.blobName))?.buf
      if (base64buf) this.loadedHtml = decodeBase64(base64buf)
      if (!this.loadedHtml) {
        throw 'Failed to load HTML'
      }
    } catch (e) {
      this.currentError = e.toString()
    }
  }

  htmlChanged () {
    let ctznElems = Array.from(this.querySelectorAll('[ctzn-elem]'))
    for (let el of ctznElems) {
      if (el.setContextState) {
        el.setContextState(this.contextState, this.context)
      }
    }
  }

  // rendering
  // =

  render () {
    if (this.currentError){
      return html`
        <div class="bg-red-100 p-6 mb-1 text-red-600">${this.currentError}</div>
      `
    }
    if (typeof this.loadedHtml === 'undefined') {
      return html`
        <div class="bg-white mb-1 sm:rounded p-6 text-center">
          <span class="spinner w-6 h-6 text-gray-400"></span>
        </div>`
    }
    return html`
      ${this.renderContextStyles()}
      <div class="custom-html">
        ${unsafeHTML(ctznHtml.sanitize(this.loadedHtml, this.context))}
      </div>
    `
  }

  renderContextStyles () {
    if (this.context === 'profile') {
      return html`
        <style>
          .custom-html > address,
          .custom-html > article,
          .custom-html > aside,
          .custom-html > blockquote,
          .custom-html > details,
          .custom-html > dialog,
          .custom-html > dd,
          .custom-html > div,
          .custom-html > dl,
          .custom-html > dt,
          .custom-html > fieldset,
          .custom-html > figcaption,
          .custom-html > figure,
          .custom-html > footer,
          .custom-html > form,
          .custom-html > h1,
          .custom-html > h2,
          .custom-html > h3,
          .custom-html > h4,
          .custom-html > h5,
          .custom-html > h6,
          .custom-html > header,
          .custom-html > hgroup,
          .custom-html > li,
          .custom-html > main,
          .custom-html > nav,
          .custom-html > ol,
          .custom-html > p,
          .custom-html > pre,
          .custom-html > section,
          .custom-html > table,
          .custom-html > ul {
            margin: 0.5rem;
          }
          .custom-html > hr {
            margin: 1em 0.5rem;
          }
          .custom-html > ctzn-post-view[mode="content-only"] {
            display: block;
            margin: 0.5rem;
          }
        </style>
      `
    }
    return ''
  }
}

customElements.define('app-custom-html', CustomHtml)
