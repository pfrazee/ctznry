import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

export class Card extends LitElement {
  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
  }

  firstUpdated () {
    // apply some custom styles to embedded elements
    for (let el of this.querySelectorAll('[ctzn-elem]')) {
      if (el.tagName === 'CTZN-POST-VIEW') {
        el.classList.add('block')
        el.classList.add('border')
        el.classList.add('border-gray-300')
        el.classList.add('rounded')
      }
    }
  }

  render () {
    return html`
      <link rel="stylesheet" href="/css/common.css">
      <link rel="stylesheet" href="/css/fontawesome.css">
      <link rel="stylesheet" href="/css/tailwind.css">
      <style>
        ::slotted(:last-child) {
          margin-bottom: 0 !important;
        }
      </style>
      <div class="bg-white px-3 py-2 sm:px-4 sm:py-3 sm:rounded mb-1">
        <slot></slot>
      </div>
    `
  }
}

customElements.define('ctzn-card', Card)
