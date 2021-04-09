import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

export class Code extends LitElement {
  constructor () {
    super()
    this.setAttribute('ctzn-elem', '1')
  }

  firstUpdated () {
    this.style.counterReset = 'line'
    this.classList.add('mb-1')
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
          background-color: #F3F4F6; /*bg-gray-100*/
          padding: 0.8rem;
          border: 1px solid #D1D5DB /*border-gray-300*/;
          border-radius: 5px;
        }
        ::slotted(:last-child) {
          margin-bottom: 0 !important;
        }
        ::slotted(code) {
          display: block;
          white-space: pre;
          color: #1F2937 /*text-gray-800*/;
          background-color: transparent;
          font-size: 90% !important;
        }
        ::slotted(code)::before {
          display: inline-block;
          text-align: right;
          width: 2ch;
          margin-right: 1ch;
          color: #9CA3AF /*text-gray-400*/;
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
