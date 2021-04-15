/* globals beaker */
import { html } from '../../../vendor/lit-element/lit-element.js'
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