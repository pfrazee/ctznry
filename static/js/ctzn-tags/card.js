import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

export class Card extends LitElement {
  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
  }

  setContextState (state, context) {
    if (state?.page?.userId) {
      if (!this.userId) {
        this.userId = state.page.userId
      }
    }
    if (context === 'post') {
      this.classList.add('block')
      this.classList.add('border')
      this.classList.add('border-gray-300')
      this.classList.add('rounded')
      this.classList.add('mb-3')
    }
  }

  firstUpdated () {
    // apply some custom styles to embedded elements
    for (let el of this.querySelectorAll('[ctzn-elem]')) {
      el.classList.add('block')
      el.classList.add('border')
      el.classList.add('border-gray-300')
      el.classList.add('rounded')
      el.classList.add('mb-0.5')
      el.classList.add('last:mb-0')
    }
  }

  render () {
    return html`
      <style>
        div {
          background: #fff;
          padding: 1em;
          margin-bottom: 0.25rem;
          border-radius: 0.25rem;
        }
        @media (max-width: 639px /*sm:*/) {
          div {
            border-radius: 0;
            padding: 0.7em 1em;
          }
        }
        ::slotted(:last-child) {
          margin-bottom: 0 !important;
        }
      </style>
      <div>
        <slot></slot>
      </div>
    `
  }
}

customElements.define('ctzn-card', Card)
