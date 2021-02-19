/* globals beaker */
import { html } from '../../../vendor/lit-element/lit-element.js'
import { repeat } from '../../../vendor/lit-element/lit-html/directives/repeat.js'
import { PERM_DESCRIPTIONS } from '../../lib/const.js'
import { BasePopup } from './base.js'
import * as session from '../../lib/session.js'
import '../button.js'

// exported api
// =

export class EditRolePopup extends BasePopup {
  static get properties () {
    return {
      currentError: {type: String},
      isProcessing: {type: Boolean},
      isNewRole: {type: Boolean},
      roleId: {type: String},
      permissions: {type: Array},
      members: {type: Array}
    }
  }

  constructor (opts) {
    super()
    this.currentError = undefined
    this.isProcessing = false
    this.communityId = opts.communityId
    this.isNewRole = !opts.roleId
    this.roleId = opts.roleId || ''
    this.permissions = opts.permissions || []
    this.members = opts.members || []
  }

  get shouldShowHead () {
    return false
  }

  get maxWidth () {
    return '520px'
  }

  // management
  //

  static async create (opts) {
    return BasePopup.create(EditRolePopup, opts)
  }

  static destroy () {
    return BasePopup.destroy('edit-role-popup')
  }

  // rendering
  // =

  renderBody () {
    return html`
      <form class="px-2" @submit=${this.onSubmit}>
        <h2 class="text-3xl py-4">${this.isNewRole ? 'Create' : 'Edit'} role</h2>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="roleId-input">Role ID</label>
          <input
            required
            type="text"
            id="roleId-input"
            name="roleId"
            class="block box-border w-full border border-gray-300 rounded p-3"
            placeholder="e.g. 'super-moderators'"
            value=${this.roleId}
            ?disabled=${!this.isNewRole}
            @keyup=${this.isNewRole ? this.onKeyupRoleId : undefined}
          />
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1">Permissions</label>
          ${this.roleId === 'admin' ? html`
            <div class="text-gray-500 px-1">Admin has full permissions.</div>
          ` : html`
            <div>
              ${repeat(Object.entries(PERM_DESCRIPTIONS), ([permId, permDesc], index) => {
                return html`
                  <div class="flex items-center">
                    <input
                      id="perm-${index}"
                      type="checkbox"
                      class="mx-2"
                      ?checked=${this.permissions.find(p => p.permId === permId)}
                      @click=${e => this.onTogglePerm(e, permId)}
                    >
                    <label for="perm-${index}">${permDesc}</label>
                  </div>
                `
              })}
            </div>
          `}
        </section>

        <section class="mb-2">
          <label class="block font-semibold p-1" for="members-textarea">Assigned</label>
          <textarea
            id="members-textarea"
            class="block box-border w-full border border-gray-300 rounded p-3"
          >${this.members?.map(m => m.value.user.userId).join(' ')}</textarea>
          <div class="text-gray-500 px-1 py-1 text-sm">
            Enter the User IDs of the assignees separated by spaces.
            This is alpha software, what do you want from me, a fancy auto-complete?
          </div>
        </section>

        ${this.currentError ? html`
          <div class="text-red-500 px-1">${this.currentError}</div>
        ` : ''}

        <div class="flex justify-between border-t border-gray-200 mt-4 pt-4">
          <ctzn-button @click=${this.onReject} tabindex="2" label="Cancel"></ctzn-button>
          <ctzn-button
            primary
            type="submit"
            tabindex="1"
            ?disabled=${this.isProcessing || !this.roleId}
            ?spinner=${this.isProcessing}
            label="${this.isNewRole ? 'Create role' : 'Save changes'}"
          ></ctzn-button>
        </div>
      </form>
    `
  }

  firstUpdated () {
    this.querySelector('input').focus()
  }

  // events
  // =

  onKeyupRoleId (e) {
    this.roleId = e.currentTarget.value.trim().replace(/[^A-z0-9]/gi, '').slice(0, 64)
    e.currentTarget.value = this.roleId
    this.requestUpdate()
  }

  onTogglePerm (e, permId) {
    if (this.permissions.find(p => p.permId === permId)) {
      this.permissions = this.permissions.filter(p => p.permId !== permId)
    } else {
      this.permissions.push({permId})
    }
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

    const memberIds = this.querySelector('#members-textarea').value
      .split(/\s/g)
      .map(id => id.trim())
      .filter(Boolean)

    if (this.isProcessing) return
    this.isProcessing = true

    let res
    this.currentError = undefined
    try {
      if (this.isNewRole) {
        res = await session.api.communities.createRole(this.communityId, {
          roleId: this.roleId,
          permissions: this.permissions
        })
        this.isNewRole = false // if a resubmit is needed due to errors in assignment, dont create again
      } else {
        res = await session.api.communities.editRole(this.communityId, this.roleId, {
          permissions: this.permissions
        })
      }
      for (let memberId of memberIds) {
        if (!this.members?.find(member => member.value.user.userId === memberId)) {
          await session.api.communities.assignRole(this.communityId, memberId, this.roleId)
        }
      }
      for (let member of this.members) {
        if (!memberIds.includes(member.value.user.userId)) {
          await session.api.communities.unassignRole(this.communityId, member.value.user.userId, this.roleId)
        }
      }
    } catch (e) {
      let error = e.toString()
      if (0 && error.includes('Validation Error')) {
        if (error.includes('/roleId')) {
          this.currentError = 'roleId must be 2 to 64 characters long, only include characters or numbers, and start with a letter.'
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
      this.isProcessing = false
    }
    this.dispatchEvent(new CustomEvent('resolve', {detail: res}))
  }
}

customElements.define('edit-role-popup', EditRolePopup)