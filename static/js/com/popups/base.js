import { LitElement, html } from '../../../vendor/lit-element/lit-element.js'
import * as history from '../../lib/history.js'

// exported api
// =

export class BasePopup extends LitElement {
  constructor () {
    super()
    this.originalPathname = undefined

    const onGlobalKeyUp = e => {
      // listen for the escape key
      if (this.shouldCloseOnEscape && e.keyCode === 27) {
        this.onReject()
      }
    }
    document.addEventListener('keyup', onGlobalKeyUp)
    window.closePopup = () => this.onReject()

    // cleanup function called on cancel
    this.cleanup = () => {
      document.removeEventListener('keyup', onGlobalKeyUp)
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  addToHistory (pathname, title = undefined) {
    this.originalPathname = window.location.pathname
    window.history.pushState({}, title, pathname)
    history.setPopHandler(e => {
      this.onReject()
    })
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
      window.closePopup = undefined
      popupEl.cleanup()
      popupEl.remove()
      history.setPopHandler(undefined)
      if (popupEl.originalPathname && window.location.pathname !== popupEl.originalPathname) {
        // closed popup without popping state and need to restore the old pathname
        window.history.replaceState({}, null, popupEl.originalPathname)
      }
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
        class="popup-wrapper fixed left-0 top-0 w-full h-full z-30 overflow-y-auto py-12 sm:py-0"
        @click=${this.onClickWrapper}
      >
        <div class="popup-inner bg-white sm:shadow sm:border border-gray-400 rounded overflow-hidden mx-auto sm:my-10" style="max-width: ${this.maxWidth}">
          ${this.shouldShowHead ? html`
            <div class="flex justify-between box-border relative bg-gray-100 py-2 px-3 w-full border-b border-gray-400 rounded-t">
              <span class="font-semibold">${this.renderTitle()}</span>
              <span title="Close" @click=${this.onReject} class="close-btn cursor-pointer"><span class="fas fa-times"></span></span>
            </div>
          ` : html`
            <div class="flex justify-between box-border relative pt-4 px-5 w-full sm:hidden">
              <span title="Close" @click=${this.onReject}><span class="fas fa-arrow-left fa-fw text-3xl"></span></span>
              <span class="font-semibold">${this.renderTitle()}</span>
            </div>
          `}
          <div class="px-4 pt-4 lg:pb-4 pb-24">
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