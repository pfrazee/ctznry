import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import * as session from './lib/session.js'
import css from '../css/login.css.js'
import './com/header.js'

class CtznLogin extends LitElement {
  static get properties () {
    return {
      isLoggingIn: {type: Boolean},
      currentError: {type: String}
    }
  }

  static get styles () {
    return css
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
    this.shadowRoot.querySelector('input#userid').focus()
  }

  // rendering
  // =

  render () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <main>
        <ctzn-header></ctzn-header>
        <div class="login-form">
          <form @submit=${this.onSubmit}>
            <h2>Login</h2>
            <div class="form-control">
              <label for="userid">Your address</label>
              <input id="userid" name="userid" required placeholder="E.g. bob@home.com">
            </div>
            <div class="form-control">
              <label for="password">Password</label>
              <input id="password" type="password" name="password" required>
            </div>
            ${this.currentError ? html`
              <div class="error">${this.currentError}</div>
            ` : ''}
            <div class="submit-controls">
              <a href="/forgot-password">Forgot Password</a>
              <button class="primary big" type="submit" ?disable=${this.isLoggingIn}>
                ${this.isLoggingIn ? html`<span class="spinner"></span>` : `Login`}
              </button>
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
    try {
      await session.doLogin(creds)
      window.location = '/'
    } catch (e) {
      console.log(e)
      this.currentError = e.data || e.message
    }
    this.isLoggingIn = false
  }

}

customElements.define('ctzn-login', CtznLogin)
