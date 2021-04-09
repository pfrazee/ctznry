import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

export class Code extends LitElement {
  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
  }

  firstUpdated () {
    this.style.counterReset = 'line'
    const rawLines = this.textContent.trim().split('\n')
    this.innerHTML = ''
    for (const rawLine of rawLines) {
      const codeLine = document.createElement('code')
      codeLine.textContent = rawLine
      this.appendChild(codeLine)
    }
  }

  render () {
    return html`
      <style>
        div {
          overflow-x: scroll;
          background-color: darkgray;
          padding: 0.8rem;
          border: 1px solid gray;
          border-radius: 5px;
        }
        ::slotted(:last-child) {
          margin-bottom: 0 !important;
        }
        ::slotted(code) {
          display: block;
          white-space: pre;
          background-color: transparent;
        }
        ::slotted(code)::before {
          display: inline-block;
          text-align: right;
          width: 2ch;
          margin-right: 1ch;
          color: gray;
          counter-increment: line;
          content: counter(line);
        }
      </style>
      <div>
        <slot></slot>
      </div>
    `
  }
}

customElements.define('ctzn-code', Code)
