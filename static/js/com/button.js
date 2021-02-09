import {LitElement, html} from '../../vendor/lit-element/lit-element.js'

export class Button extends LitElement {
  static get properties () {
    return {
      label: {type: String},
      href: {type: String},
      disable: {type: Boolean},
      spinner: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
  }

  getClass () {
    let parentClass = this.className || ''
    let colors = 'bg-white border border-gray-300 hover:bg-gray-100'
    if (this.hasAttribute('primary')) {
      colors = 'bg-blue-600 text-white hover:bg-blue-700'
      if (this.disable) {
        colors = 'bg-blue-400 text-blue-50'
      }
    } else if (this.disable) {
      colors = 'bg-gray-100 text-gray-50'
    }
    let paddings = ''
    if (!/p(x|l|r)-/.test(parentClass)) paddings += 'px-4'
    if (!/p(y|t|b)-/.test(parentClass)) paddings += 'py-2'
    return `rounded border-1 ${colors} ${paddings} shadow-sm ${parentClass}`
  }

  renderSpinner () {
    let colors = 'text-gray-500'
    if (this.hasAttribute('primary')) {
      colors = 'text-blue-300'
    }
    return html`<span class="spinner ${colors}"></span>`
  }

  render () {
    if (this.href) {
      return html`
        <a href=${this.href} class="inline-block ${this.getClass()}" ?disable=${this.disable}>${this.spinner ? this.renderSpinner() : this.label}</a>
      `
    }
    return html`
      <button class=${this.getClass()} ?disable=${this.disable}>${this.spinner ? this.renderSpinner() : this.label}</button>
    `
  }
}

customElements.define('ctzn-button', Button)
