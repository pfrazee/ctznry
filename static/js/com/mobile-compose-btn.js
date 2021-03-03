import {LitElement, html} from '../../vendor/lit-element/lit-element.js'
import { ComposerPopup } from './popups/composer.js'
import { emit } from '../lib/dom.js'
import * as toast from './toast.js'

export class MobileComposeBtn extends LitElement {
  static get properties () {
    return {
      community: {type: Object}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.community = undefined
  }

  render () {
    return html`
      <div
        class="fixed z-30 flex items-center justify-center bg-blue-500 text-white w-12 h-12 rounded-full shadow-lg lg:hidden"
        style="right: 10px; bottom: calc(70px + env(safe-area-inset-bottom))"
        @click=${this.onClickCreatePost}
      ><span class="fas fa-feather-alt"></span></div>
    `
  }


  // events
  // =

  async onClickCreatePost (e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await ComposerPopup.create({
        community: this.community
      })
      toast.create('Post published', '', 10e3)
      emit(this, 'post-created')
    } catch (e) {
      // ignore
      console.log(e)
    }
  }
}

customElements.define('ctzn-mobile-compose-btn', MobileComposeBtn)
