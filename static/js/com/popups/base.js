import { LitElement, html } from '../../../vendor/lit-element/lit-element.js'

// exported api
// =

export class BasePopup extends LitElement {
  constructor () {
    super()

    const onGlobalKeyUp = e => {
      // listen for the escape key
      if (this.shouldCloseOnEscape && e.keyCode === 27) {
        this.onReject()
      }
    }
    document.addEventListener('keyup', onGlobalKeyUp)

    // cleanup function called on cancel
    this.cleanup = () => {
      document.removeEventListener('keyup', onGlobalKeyUp)
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  get shouldShowHead () {
    return true
  }

  get shouldCloseOnOuterClick () {
    return true
  }

  get shouldCloseOnEscape () {
    return true
  }

  get maxWidth () {
    return '450px'
  }

  // management
  //

  static async coreCreate (parentEl, Class, ...args) {
    var popupEl = new Class(...args)
    parentEl.appendChild(popupEl)

    const cleanup = () => {
      popupEl.cleanup()
      popupEl.remove()
    }

    // return a promise that resolves with resolve/reject events
    return new Promise((resolve, reject) => {
      popupEl.addEventListener('resolve', e => {
        resolve(e.detail)
        cleanup()
      })

      popupEl.addEventListener('reject', e => {
        reject()
        cleanup()
      })
    })
  }

  static async create (Class, ...args) {
    return BasePopup.coreCreate(document.body, Class, ...args)
  }

  static destroy (tagName) {
    var popup = document.querySelector(tagName)
    if (popup) popup.onReject()
  }

  // rendering
  // =

  render () {
    return html`
      <div
        class="popup-wrapper fixed left-0 top-0 w-full h-full z-50 overflow-y-auto"
        style="background: rgba(0,0,0,0.45)"
        @click=${this.onClickWrapper}
      >
        <div class="popup-inner bg-white shadow border border-gray-400 rounded overflow-hidden" style="margin: 80px auto; max-width: ${this.maxWidth}">
          ${this.shouldShowHead ? html`
            <div class="flex justify-between box-border relative bg-gray-100 py-2 px-3 w-full border-b border-gray-400 rounded-t">
              <span class="font-semibold">${this.renderTitle()}</span>
              <span title="Close" @click=${this.onReject} class="close-btn cursor-pointer">&times;</span>
            </div>
          ` : ''}
          <div class="p-4">
            ${this.renderBody()}
          </div>
        </div>
      </div>
    `
  }

  renderTitle () {
    // should be overridden by subclasses
  }

  renderBody () {
    // should be overridden by subclasses
  }

  // events
  // =

  onClickWrapper (e) {
    if (e.target.classList.contains('popup-wrapper') && this.shouldCloseOnOuterClick) {
      this.onReject()
    }
  }

  onReject (e) {
    if (e) e.preventDefault()
    this.dispatchEvent(new CustomEvent('reject'))
  }
}