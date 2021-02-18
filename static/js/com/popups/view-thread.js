/* globals beaker */
import { html, css } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import '../thread.js'

// exported api
// =

export class ViewThreadPopup extends BasePopup {
  constructor (opts) {
    super()
    this.subject = opts.subject
  }

  static get properties () {
    return {
      recordUrl: {type: String}
    }
  }

  get maxWidth () {
    return '700px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewThreadPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-thread-popup')
  }

  // rendering
  // =

  get shouldShowHead () {
    return false
  }

  renderBody () {
    return html`
      <ctzn-thread
        .subject=${this.subject}
        @load=${this.onLoadThread}
        @view-thread=${this.onViewThread}
      ></ctzn-thread>
    `
  }

  // events
  // =

  onLoadThread () {
    this.querySelector('ctzn-thread').scrollHighlightedPostIntoView()
  }

  onViewThread (e) {
    this.subject = e.detail.subject
    this.requestUpdate()
  }
}

customElements.define('view-thread-popup', ViewThreadPopup)