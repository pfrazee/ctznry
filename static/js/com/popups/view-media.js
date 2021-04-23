/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'

// exported api
// =

export class ViewMediaPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.url = opts.url
  }

  get shouldShowHead () {
    return false
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get shouldCloseOnEscape () {
    return true
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(ViewMediaPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('view-media-popup')
  }

  // rendering
  // =

  render () {
    return html`
      <div
        class="popup-wrapper fixed left-0 top-0 w-full h-full z-50 overflow-y-auto"
        style="background: #000d"
        @click=${this.onClickWrapper}
      >
        <span
          title="Close"
          @click=${this.onReject}
          class="absolute bg-white close-btn cursor-pointer px-2 rounded text-3xl text-black z-50"
          style="top: 10px; right: 15px"
        >
          <span class="fas fa-times"></span>
        </span>
        <div class="flex w-full h-full items-center justify-center pointer-events-none">
          <img class="block border border-white shadow-lg" src=${this.url}>
        </div>
      </div>
    `
  }


  // events
  // =
}

customElements.define('view-media-popup', ViewMediaPopup)