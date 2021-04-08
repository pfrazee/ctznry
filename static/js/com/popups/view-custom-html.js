/* globals beaker */
import { html } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import '../custom-html.js'

// exported api
// =

export class ViewCustomHtmlPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.userId = opts.userId
    this.blobName = opts.blobName
    this.html = opts.html
    this.context = opts.context
    this.contextState = opts.contextState
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnEscape () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get maxWidth () {
    return '710px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewCustomHtmlPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-custom-html-popup')
  }

  // rendering
  // =

  renderBody () {
    let cls = 'overflow-auto'
    if (this.context === 'profile') {
      cls += ' bg-gray-200 rounded-xl p-4'
    }
    return html`
      <div class=${cls} style="max-height: calc(100vh - 100px)">
        <app-custom-html
          .userId=${this.userId}
          .blobName=${this.blobName}
          .html=${this.html}
          .context=${this.context}
          .contextState=${this.contextState}
        ></app-custom-html>
      </div>
    `
  }
}

customElements.define('view-custom-html-popup', ViewCustomHtmlPopup)