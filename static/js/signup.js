import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import * as session from './lib/session.js'
import './com/header.js'
import './com/button.js'

class CtznSignup extends LitElement {
  static get properties () {
    return {
      isSigningUp: {type: Boolean},
      currentError: {type: String}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.isSigningUp = false
    this.currentError = undefined
    this.load()
  }

  async load () {
    await session.setup()
  }

  firstUpdated () {
    this.querySelector('input#domain').focus()
  }

  // rendering
  // =

  render () {
    return html`
      <main>
        <ctzn-header></ctzn-header>
        <div class="mx-auto my-12 max-w-md border border-gray-200 p-8 bg-gray-50">
          <form @submit=${this.onSubmit}>
            <h2 class="mb-6 text-xl">Sign up</h2>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="domain">Server</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="domain" name="domain" required placeholder="E.g. home.com">
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="username">Username</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="username" name="username" required placeholder="E.g. bob">
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="displayName">Display Name</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="displayName" name="displayName" required placeholder="E.g. Bob Roberts">
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="description">Bio line</label>
              <textarea class="block w-full box-border mb-1 p-4 border border-gray-300" id="description" name="description" placeholder="E.g. A new CTZN user! (optional)"></textarea>
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="avatar">Avatar</label>
              <input type="file" accept="image/*" id="avatar" name="avatar">
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="email">Your email</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="email" name="email" required placeholder="E.g. bob@mail.com">
            </div>
            <div class="mb-6">
              <label class="block w-full box-border mb-1" for="password">Password</label>
              <input class="block w-full box-border mb-1 p-4 border border-gray-300" id="password" type="password" name="password" required>
            </div>
            ${this.currentError ? html`
              <div class="bg-red-100 p-6 text-red-600">${this.currentError}</div>
            ` : ''}
            <div class="flex justify-between items-center border-t border-gray-300 mt-10 pt-6">
              <a href="/login">Log in to an existing account</a>
              <ctzn-button
                primary
                type="submit"
                ?disabled=${this.isSigningUp}
                ?spinner=${this.isSigningUp}
                label="Sign up"
              ></ctzn-button>
            </div>
          </form>
        </div>
        <div class="text-center text-xs mt-4 mb-14">FYI This is a crummy temporary UI for Testnet Saturday</div>
      </main>
    `
  }

  // events
  // =

  async onSubmit (e) {
    e.preventDefault()
    this.isSigningUp = true
    this.currentError = undefined
    let info = {
      domain: e.target.domain.value,
      username: e.target.username.value,
      displayName: e.target.displayName.value,
      description: e.target.description.value,
      email: e.target.email.value,
      password: e.target.password.value,
      avatarBase64: undefined
    }

    const avatarFile = e.target.avatar.files[0]
    if (avatarFile) {
      info.avatarBase64 = await new Promise((resolve) => {
        let fr = new FileReader()
        fr.onload = () => resolve(fr.result.split(',').pop())
        fr.readAsDataURL(avatarFile)
      })
    }

    try {
      await session.doSignup(info)
      window.location = '/'
    } catch (e) {
      console.log(e)
      this.currentError = e.data || e.message
    }
    this.isSigningUp = false
  }

}

customElements.define('ctzn-signup', CtznSignup)
