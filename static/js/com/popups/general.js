/* globals beaker */
import { html } from '../../../vendor/lit/lit.min.js'
import { BasePopup } from './base.js'
import '../custom-html.js'

// exported api
// =

export class GeneralPopup extends BasePopup {
  static get properties () {
    return {
    }
  }

  constructor (opts) {
    super()
    this.customBodyClass = opts.bodyClass
    this.renderFn = opts.render
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

  get bodyClass () {
    if (this.customBodyClass) {
      return this.customBodyClass
    }
    return 'px-4 pt-4 lg:pb-4 pb-24'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(GeneralPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('general-popup')
  }

  // rendering
  // =

  renderBody () {
    return this.renderFn()
  }
}

customElements.define('general-popup', GeneralPopup)