import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import { emit } from '../lib/dom.js'
import * as gestures from '../lib/gestures.js'
import './button.js'

export class Subnav extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String, attribute: 'current-path'},
      items: {type: Array},
      navClass: {type: String, attribute: 'nav-cls'},
      borderLeft: {type: Number},
      borderWidth: {type: Number}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.items = []
    this.navClass = ''
    this.currentPath = undefined
    this.borderLeft = undefined
    this.borderWidth = 0
  }
  
  getNavCls (path, mobileOnly) {
    return `
      block text-center pt-2 pb-2.5 px-4 sm:px-7 whitespace-nowrap font-semibold cursor-pointer
      hover:bg-gray-50 hover:text-blue-600
      ${mobileOnly ? 'sm:hidden' : ''}
      ${path === this.currentPath ? 'text-blue-600' : ''}
    `.replace('\n', '')
  }

  updated (changedProperties) {
    if (changedProperties.has('currentPath')) {
      const el = this.querySelector(`a[href="${this.currentPath}"]`)
      if (!el) return
      const rect = el.getClientRects()[0]
      this.borderLeft = el.offsetLeft
      this.borderWidth = rect?.width
    }
  }

  connectedCallback () {
    super.connectedCallback()
    gestures.setOnSwiping((dx, dxN) => {
      this.borderEl.style.left = `${this.borderLeft + -dxN * this.borderWidth * 0.15}px`
    })
    this.className = `
      sticky top-0 z-10 flex overflow-x-auto bg-white sm:rounded ${this.navClass}
    `
    this.style = `
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      background: rgba(255, 255, 255, 0.9);
    `
  }

  disconnectedCallback () {
    super.disconnectedCallback()
    gestures.setOnSwiping(undefined)
  }

  get borderEl () {
    return this.querySelector('.absolute')
  }

  // rendering
  // =

  render () {
    return html`
      ${typeof this.borderLeft === 'number' ? html`
        <div
          class="absolute bg-blue-600"
          style="
            left: ${this.borderLeft}px;
            bottom: 0;
            width: ${this.borderWidth}px;
            height: 2px;
            transition: left 0.1s;
          "
        ></div>
      ` : ''}
      ${repeat(this.items, item => item.path, item => html`
        <a
          class="${this.getNavCls(item.path, item.mobileOnly)}"
          href=${item.path}
          @click=${e => this.onClickItem(e, item)}
        >${item.label}</a>
      `)}
    `
  }

  // events
  // =

  onClickItem (e, item) {
    e.preventDefault()
    if (item.menu) {
      emit(this, 'open-main-menu')
    } else if (item.back) {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url: '/', replace: true}}))
      }
    } else {
      emit(this, 'navigate-to', {detail: {url: item.path, replace: true}})
    }
  }
}

customElements.define('ctzn-subnav', Subnav)
