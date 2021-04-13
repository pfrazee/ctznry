import { html, render } from '../../vendor/lit-element/lit-html/lit-html.js'

export function createBaseClass (win, doc, editor) {
  return class EditorComponent extends win.HTMLElement {
    constructor () {
      super()
      this.setAttribute('contenteditable', false)
      this.attachShadow({mode: 'open'})
      
      for (let attrName of this.constructor.observedAttributes) {
        Object.defineProperty(this, attrName, {
          get: () => {
            return this.getAttribute(attrName)
          },
          set: (v) => {
            this.setAttribute(attrName, v)
          }
        })
      }

      this.updateDom()
    }

    connectedCallback () {
      this.updateDom()
    }

    updateDom () {
      render(this.render(), this.shadowRoot)
    }

    render () {
      return html`
        TODO - override render()
      `
    }

    attributeChangedCallback (name, oldValue, newValue) {
      this.updateDom()
    }
  }
}