import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import * as session from './lib/session.js'
import './com/header.js'
import './com/button.js'

class CtznLogin extends LitElement {
  static get properties () {
    return {
      isLoggingIn: {type: Boolean},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isLoggingIn = false
    this.currentError = undefined
    this.load()
  }

  async load () {
    await session.setup()
  }

  firstUpdated () {
    this.querySelector('input#userid').focus()
  }

  // rendering
  // =

  render () {
    return html`
      <main>
        <ctzn-header></ctzn-header>
        <div class="mx-auto my-12 max-w-md border border-gray-200 p-8 bg-gray-50">
          <form @submit=${this.onSubmit}>
            <h2 class="mb-6 text-xl">Login</h2>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="userid">Your address</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="userid" name="userid" required placeholder="E.g. bob@home.com">
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="password">Password</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="password" type="password" name="password" required>
            </div>
            ${this.currentError ? html`
              <div class="bg-red-100 p-6 text-red-600">${this.currentError}</div>
            ` : ''}
            <div class="flex justify-between items-center border-t border-gray-300 mt-10 pt-6">
              <a href="/forgot-password">Forgot Password</a>
              <ctzn-button
                primary
                type="submit"
                ?disabled=${this.isLoggingIn}
                ?spinner=${this.isLoggingIn}
                label="Login"
              ></ctzn-button>
            </div>
          </form>
        </div>
      </main>
    `
  }

  // events
  // =

  async onSubmit (e) {
    e.preventDefault()
    this.isLoggingIn = true
    this.currentError = undefined
    let creds = {
      userId: e.target.userid.value,
      password: e.target.password.value
    }
    if (!creds.userId.includes('@')) {
      this.currentError = 'Invalid address: should look like an email (eg bob@home.com).'
    } else {
      try {
        await session.doLogin(creds)
        window.location = '/'
      } catch (e) {
        console.log(e)
        this.currentError = e.data || e.message
      }
    }
    this.isLoggingIn = false
  }

}

customElements.define('ctzn-login', CtznLogin)
