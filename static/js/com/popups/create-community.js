/* globals beaker */
import { html, css } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import popupsCSS from '../../../css/com/popups.css.js'
import spinnerCSS from '../../../css/com/spinner.css.js'

// exported api
// =

export class CreateCommunityPopup extends BasePopup {
  static get properties () {
    return {
      currentError: {type: String},
      isCreating: {type: Boolean},
      username: {type: String},
      displayName: {type: String},
      description: {type: String}
    }
  }

  constructor (opts) {
    super()
    this.currentError = undefined
    this.isCreating = false
    this.username = ''
    this.displayName = ''
    this.description = ''
  }

  get shouldShowHead () {
    return false
  }

  static get styles () {
    return [popupsCSS, spinnerCSS, css`
    .popup-inner {
      width: 520px;
      border-radius: 8px;
    }

    .popup-inner .body {
      padding: 6px 22px 22px;
    }

    input[type="text"] {
      padding: 10px;
    }
    `]
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(CreateCommunityPopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('create-community-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <link rel="stylesheet" href="/css/fontawesome.css">
      <h2>Create a community</h2>
      <form @submit=${this.onSubmit}>
        <section>
          <label for="username-input">Community ID</label>
          <input
            required
            type="text"
            id="username-input"
            name="username"
            placeholder="e.g. 'friends' or 'cool-hackers'"
            value=${this.username}
            @keyup=${this.onKeyupUsername}
          />
        </section>

        <section>
          <label for="displayName-input">Display name</label>
          <input
            required
            type="text"
            id="displayName-input"
            name="displayName"
            placeholder="e.g. 'Friends' or 'Cool Hackers'"
            value=${this.displayName}
            @keyup=${this.onKeyupDisplayName}
          />
        </section>

        <section>
          <label for="description-input">Description</label>
          <input
            type="text"
            id="description-input"
            name="description"
            placeholder="e.g. 'A cool place for cool people'"
            value=${this.description}
            @keyup=${this.onKeyupDescription}
          />
        </section>

        ${this.currentError ? html`
          <div class="error">${this.currentError}</div>
        ` : ''}

        <div class="actions">
          <button type="button" class="btn" @click=${this.onReject} tabindex="2">Cancel</button>
          <button type="submit" class="btn primary" tabindex="1" ?disabled=${this.isCreating || !this.username || !this.displayName}>
            ${this.isCreating ? html`<span class="spinner"></span>` : html`
              <span class="fas fa-fw fa-users"></span>
              Create Community
            `}
          </button>
        </div>
      </form>
    `
  }

  firstUpdated () {
    this.shadowRoot.querySelector('input').focus()
  }

  // events
  // =

  onKeyupUsername (e) {
    this.username = e.currentTarget.value.trim().replace(/[^A-z0-9]/gi, '').slice(0, 64)
    e.currentTarget.value = this.username
    this.requestUpdate()
  }

  onKeyupDisplayName (e) {
    this.displayName = e.currentTarget.value.slice(0, 64)
    e.currentTarget.value = this.displayName
    this.requestUpdate()
  }

  onKeyupDescription (e) {
    this.description = e.currentTarget.value.slice(0, 256)
    e.currentTarget.value = this.description
    this.requestUpdate()
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    if (this.isCreating) return
    this.isCreating = true

    let res
    this.currentError = undefined
    try {
      res = await session.api.communities.create({
        username: this.username,
        displayName: this.displayName,
        description: this.description
      })
    } catch (e) {
      let error = e.toString()
      if (error.includes('Validation Error')) {
        if (error.includes('/username')) {
          this.currentError = 'Username must be 2 to 64 characters long, only include characters or numbers, and start with a letter.'
        } else if (error.includes('/displayName')) {
          this.currentError = 'Display name must be 1 to 64 characters long.'
        } else if (error.includes('/desc')) {
          this.currentError = 'Description must be 256 characters or less.'
        } else {
          this.currentError = error
        }
      } else {
        this.currentError = error
      }
      return
    } finally {
      this.isCreating = false
    }
    this.dispatchEvent(new CustomEvent('resolve', {detail: res}))
  }
}

customElements.define('create-community-popup', CreateCommunityPopup)