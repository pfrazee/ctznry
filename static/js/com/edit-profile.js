import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as session from '../lib/session.js'
import * as images from '../lib/images.js'
import { slugify, encodeBase64, decodeBase64 } from '../lib/strings.js'
import { deepClone } from '../lib/functions.js'
import { emit } from '../lib/dom.js'
import { AVATAR_URL, BLOB_URL, DEFAULT_COMMUNITY_PROFILE_SECTIONS, DEFAULT_CITIZEN_PROFILE_SECTIONS } from '../lib/const.js'
import { ViewCustomHtmlPopup } from './popups/view-custom-html.js'
import * as toast from './toast.js'
import './button.js'
import './code-textarea.js'
import './img-fallbacks.js'

export class EditProfile extends LitElement {
  static get properties () {
    return {
      userId: {type: String, attribute: 'user-id'},
      profile: {type: Object},
      _hasChanges: {type: Boolean},
      values: {type: Object},
      customUIOverride: {type: Boolean},
      currentView: {type: String},
      currentError: {type: String},
      isProcessing: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.userId = undefined
    this.profile = undefined
    this.hasChanges = false
    this.values = undefined
    this.customUIOverride = undefined
    this.currentView = 'basics'
    this.currentError = undefined
    this.img = undefined
    this.uploadedAvatar = undefined
    this.uploadedBanner = undefined
    this.isProcessing = false
  }

  get isCitizen () {
    return this.profile?.dbType === 'ctzn.network/public-citizen-db'
  }

  get isCommunity () {
    return this.profile?.dbType === 'ctzn.network/public-community-db'
  }

  get hasCustomUI () {
    if (typeof this.customUIOverride === 'boolean') {
      return this.customUIOverride
    }
    return this.values?.sections?.length
  }

  updated (changedProperties) {
    if (changedProperties.has('profile') && this.profile) {
      this.load()
    }
  }

  async load () {
    if (this.profile?.value?.sections?.length) {
      for (let section of this.profile.value.sections) {
        if (!section.html) {
          try {
            let base64buf = (await session.ctzn.blob.get(this.userId, `ui:profile:${section.id}`))?.buf
            if (base64buf) section.html = decodeBase64(base64buf)
          } catch (e) {
            console.log('Failed to load blob', e)
          }
          if (!section.html) {
            section.html = ''
          }
        }
      }
    }
    this.values = JSON.parse(JSON.stringify(this.profile.value)) // the ole deep clone
  }

  get hasChanges () {
    return this._hasChanges
  }

  set hasChanges (v) {
    this._hasChanges = v
    document.body.querySelector('app-root').pageHasChanges = v
  }

  getValue (path) {
    return getByPath(this.values, path)
  }

  setValue (path, v) {
    setByPath(this.values, path, v)
    this.hasChanges = true
  }

  setCustomUI (v) {
    this.hasChanges = true
    this.customUIOverride = v
    if (v && !this.values?.sections?.length) {
      if (this.isCommunity) {
        this.setValue(['sections'], deepClone(DEFAULT_COMMUNITY_PROFILE_SECTIONS))
      } else {
        this.setValue(['sections'], deepClone(DEFAULT_CITIZEN_PROFILE_SECTIONS))
      }
    }
    this.requestUpdate()
  }

  // rendering
  // =

  render () {
    if (!this.values) return html``
    const navItem = (id, label) => html`
      <div
        class="
          py-2 pl-4 pr-6 hov:hover:bg-gray-100 cursor-pointer
          ${id === this.currentView ? 'text-blue-600 border-b sm:border-b-0 sm:border-r-4 border-blue-600' : ''}
        "
        @click=${e => {this.currentView = id}}
      >${label}</div>
    `
    return html`
      <form @submit=${this.onSubmit} class="bg-white sm:rounded mb-0.5">
        <div class="border-b border-gray-200 flex items-center justify-between pl-4 pr-2 py-2 rounded-t">
          <div class="text-lg font-semibold">Edit profile</div>
          <app-button
            ?primary=${this.hasChanges}
            ?disabled=${!this.hasChanges || this.isProcessing}
            ?spinner=${this.isProcessing}
            btn-class="py-1 px-2 text-sm"
            btn-type="submit"
            label="Save changes"
          ></app-button>
        </div>
        ${this.currentError ? html`
          <div class="bg-red-100 p-6 mt-2 mb-4 text-red-600">${this.currentError}</div>
        ` : ''}
        <div class="sm:flex">
          <div class="flex sm:block border-b sm:border-b-0 sm:border-r border-gray-200 sm:w-32">
            ${navItem('basics', 'Basics')}
            ${navItem('images', 'Images')}
            ${navItem('advanced', 'Advanced')}
          </div>
          <div class="sm:flex-1 px-4 pt-2 pb-4">
            <div class="${this.currentView === 'basics' ? 'block' : 'hidden'}">
              <label class="block font-semibold p-1" for="displayName-input">Display Name</label>
              <input
                autofocus
                type="text"
                id="displayName-input"
                name="displayName"
                value="${this.values.displayName}"
                class="block box-border w-full border border-gray-300 rounded p-3 mb-1"
                placeholder="Anonymous"
                @keyup=${e => this.onKeyupValue(e, ['displayName'])}
              />

              <label class="block font-semibold p-1" for="description-input">Bio</label>
              <textarea
                id="description-input"
                name="description"
                class="block box-border w-full border border-gray-300 rounded p-3"
                @keyup=${e => this.onKeyupValue(e, ['description'])}
              >${this.values.description}</textarea>
            </div>

            <div class="${this.currentView === 'images' ? 'block' : 'hidden'}">
              <div class="mb-2">
                <label class="block font-semibold p-1">Banner Image</label>
                ${!this.uploadedBanner ? html`
                  <app-img-fallbacks>
                    <img
                      slot="img1"
                      class="block rounded-2xl border border-gray-400 w-full object-cover cursor-pointer hov:hover:opacity-50"
                      style="width: 320px; height: 150px"
                      src=${BLOB_URL(this.userId, 'profile-banner')} 
                      @click=${this.onClickBanner}
                    >
                    <div
                      slot="img2"
                      class="block rounded-2xl border border-gray-400 cursor-pointer hov:hover:opacity-50"
                      style="width: 320px; height: 150px; background: linear-gradient(0deg, #3c4af6, #2663eb);"
                      @click=${this.onClickBanner}
                    ></div>
                  </app-img-fallbacks>
                ` : html`
                  <img
                    class="block rounded-2xl border border-gray-400 w-full object-cover cursor-pointer hov:hover:opacity-50"
                    style="width: 320px; height: 150px"
                    src=${this.uploadedBanner} 
                    @click=${this.onClickBanner}
                  >
                `}
              </div>
              <div class="mb-2">
                <label class="block font-semibold p-1">Profile Image</label>
                <img 
                  class="block border border-gray-400 rounded-3xl object-cover cursor-pointer hov:hover:opacity-50"
                  style="width: 150px; height: 150px;"
                  src=${this.uploadedAvatar || AVATAR_URL(this.userId)}
                  @click=${this.onClickAvatar}
                >
              </div>
              <input id="banner-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseBannerFile}>
              <input id="avatar-file-input" class="hidden" type="file" accept=".jpg,.jpeg,.png,.svg" @change=${this.onChooseAvatarFile}>
            </div>

            <div class="${this.currentView === 'advanced' ? 'block' : 'hidden'}">
              <label class="block font-semibold p-1">Profile UI</label>
              <div class="mb-2">
                <app-button
                  transparent
                  icon="far fa-${this.hasCustomUI ? 'circle' : 'check-circle'}"
                  label="Default UI"
                  @click=${e => this.setCustomUI(false)}
                ></app-button>
                <app-button
                  transparent
                  icon="far fa-${!this.hasCustomUI ? 'circle' : 'check-circle'}"
                  label="Custom UI"
                  @click=${e => this.setCustomUI(true)}
                ></app-button>
              </div>
              ${!this.hasCustomUI ? html`
                <div class="py-4 pl-4 pr-6 text-gray-500 text-sm bg-gray-100 rounded">
                  <p class="mb-2 text-black"><strong class="text-black">Default UI.</strong> CTZN will create your profile's User Interface for you.</p>
                  <p>
                    You can create a custom UI if you're familiar with HTML.
                    If something goes wrong, you can go back to the Default UI!
                  </p>
                </div>
              ` : html`
                <div class="py-4 pl-4 pr-6 mb-2 text-gray-500 text-sm bg-gray-100 rounded">
                  <p class="mb-2 text-black"><strong class="text-black">Custom UI.</strong> Design your profile's User Interface.</p>
                  <p>
                    Add, edit, and re-order the sections of your profile below.
                  </p>
                </div>
              `}
              <div class="${this.hasCustomUI ? 'block' : 'hidden'} rounded border border-gray-200">
                ${this.values?.sections?.length ? html`
                  ${repeat(this.values.sections, section => section.id, this.renderSection.bind(this))}
                ` : ''}
                <div class="bg-white rounded px-2 py-2 border-t border-gray-200">
                  <app-button
                    transparent
                    btn-class="px-2 py-1"
                    icon="fas fa-plus"
                    label="Add Section"
                    @click=${this.onAddSection}
                  ></app-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    `
  }

  renderSection (section, i) {
    return html`
      <div class="bg-white rounded px-2 py-2 ${i !== 0 ? 'border-t border-gray-200' : ''}">
        <input
          type="text"
          class="block w-full box-border border border-gray-200 rounded px-3 py-1 mb-1 font-medium"
          value=${section.label || ''}
          required
          placeholder="Label"
          @keyup=${e => this.onKeyupValue(e, ['sections', i, 'label'])}
        >
        <app-code-textarea
          textarea-class="block w-full box-border font-mono border border-gray-200 rounded px-3 py-1 h-32 mb-1 text-sm"
          @keyup=${e => this.onKeyupValue(e, ['sections', i, 'html'])}
          .value=${section.html}
        ></app-code-textarea>
        <div class="flex items-center mb-1">
          <app-button transparent btn-class="px-2 py-1 text-sm" label="Preview" @click=${e => this.onPreviewSection(e, i)}></app-button>
          <span class="text-sm ml-2">
            Move:
            ${i === 0 ? html`
              <span class="fas fa-arrow-up px-1.5 py-0.5 text-gray-300"></span>
            ` : html`
              <app-button
                transparent
                btn-class="px-1.5 py-0.5"
                icon="fas fa-arrow-up"
                data-tooltip="Move up in the nav order"
                @click=${e => this.onMoveSection(e, i, -1)}
              ></app-button>
            `}
            ${i === this.values.sections.length - 1 ? html`
              <span class="fas fa-arrow-down px-1.5 py-0.5 text-gray-300"></span>
            ` : html`
              <app-button
                transparent
                btn-class="px-1.5 py-0.5"
                icon="fas fa-arrow-down"
                data-tooltip="Move down in the nav order"
                @click=${e => this.onMoveSection(e, i, 1)}
              ></app-button>
            `}
          </span>
          <app-button
            transparent
            btn-class="px-2 py-1 text-red-500 text-sm"
            class="ml-auto"
            label="Delete"
            @click=${e => this.onDeleteSection(e, i)}
          ></app-button>
        </div>
      </div>
    `
  }

  // events
  // =

  onKeyupValue (e, path) {
    let v = (e.target.value || '').trim()
    if (this.getValue(path) !== v) {
      this.setValue(path, v)
    }
  }

  onAddSection (e) {
    this.values.sections.push({id: '', label: '', html: ''})
    this.hasChanges = true
    this.requestUpdate()
  }

  onMoveSection (e, index, dir) {
    let tmp = this.values.sections[index + dir]
    this.values.sections[index + dir] = this.values.sections[index]
    this.values.sections[index] = tmp
    this.hasChanges = true
    this.requestUpdate()
  }

  onDeleteSection (e, index) {
    if (!confirm('Delete this section?')) {
      return
    }
    this.values.sections.splice(index, 1)
    this.hasChanges = true
    this.requestUpdate()
  }

  onPreviewSection (e, index) {
    ViewCustomHtmlPopup.create({
      html: this.values.sections[index].html,
      context: 'profile',
      contextState: {page: {userId: this.userId}}
    })
  }

  onClickBanner (e) {
    e.preventDefault()
    this.querySelector('#banner-file-input').click()
  }

  onChooseBannerFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.uploadedBanner = fr.result
      this.hasChanges = true
      this.requestUpdate()
    }
    fr.readAsDataURL(file)
  }

  onClickAvatar (e) {
    e.preventDefault()
    this.querySelector('#avatar-file-input').click()
  }

  onChooseAvatarFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      this.uploadedAvatar = fr.result
      this.hasChanges = true
      this.requestUpdate()
    }
    fr.readAsDataURL(file)
  }

  async onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    this.currentError = undefined
    this.isProcessing = true

    try {
      let isPending = false

      if (this.customUIOverride === false) {
        this.values.sections = undefined
      }

      // update profile data
      if (hasChanges(this.values, this.profile.value)) {
        let usedSectionIds = new Set()
        for (let section of (this.values.sections || [])) {
          const baseId = slugify(section.label).toLocaleLowerCase()
          let id = baseId
          let n = 2
          while (usedSectionIds.has(id)) {
            id = `${baseId}-${n}`
            n++
          }
          usedSectionIds.add(baseId)
          section.id = id
        }

        // build a list of section blobs to update
        let sectionBlobUpdates = []
        for (let section of (this.values.sections || [])) {
          let oldSection = this.profile.value.sections?.find(old => old.id === section.id)
          if (!oldSection || oldSection.html !== section.html) {
            sectionBlobUpdates.push({id: section.id, html: section.html})
          }
        }

        if (this.isCitizen) {
          // upload section blobs
          for (let update of sectionBlobUpdates) {
            await session.ctzn.blob.update(
              `ui:profile:${update.id}`,
              encodeBase64(update.html),
              {mimeType: 'text/html'}
            )
          }

          // update profile record
          const record = {
            displayName: this.values.displayName,
            description: this.values.description,
            sections: this.values.sections?.length
              ? this.values.sections.map(s => ({id: s.id, label: s.label}))
              : undefined
          }
          await session.ctzn.user.table('ctzn.network/profile').create(record)
        } else if (this.isCommunity) {
          // upload section blobs to the community
          for (let update of sectionBlobUpdates) {
            let res = await session.ctzn.blob.create(
              encodeBase64(update.html),
              {mimeType: 'text/html'}
            )
            let res2 = await session.ctzn.db(this.userId).method(
              'ctzn.network/put-blob-method',
              {
                source: {
                  userId: session.info.userId,
                  dbUrl: session.info.dbUrl,
                  blobName: res.name
                },
                target: {
                  blobName: `ui:profile:${update.id}`
                }
              }
            )
            isPending = isPending || res2.pending()
          }

          // update the community profile
          const arg = {
            displayName: this.values.displayName,
            description: this.values.description,
            sections: this.values.sections?.length
              ? this.values.sections.map(s => ({id: s.id, label: s.label}))
              : undefined
          }
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-profile-method',
            arg
          )
          isPending = isPending || res.pending()
        }
      }

      // update avatar
      if (this.uploadedAvatar) {
        toast.create('Uploading avatar...')
        if (this.isCitizen) {
          await uploadBlob('avatar', this.uploadedAvatar)
        } else if (this.isCommunity) {
          const blobRes = await uploadBlob(undefined, this.uploadedAvatar)
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-avatar-method',
            {
              blobSource: {userId: session.info.userId, dbUrl: session.info.dbUrl},
              blobName: blobRes.name
            }
          )
          isPending = isPending || res.pending()
        }
      }

      // update banner
      if (this.uploadedBanner) {
        toast.create('Uploading banner image...')
        if (this.isCitizen) {
          await uploadBlob('profile-banner', this.uploadedBanner)
        } else if (this.isCommunity) {
          const blobRes = await uploadBlob(undefined, this.uploadedBanner)
          let res = await session.ctzn.db(this.userId).method(
            'ctzn.network/put-blob-method',
            {
              source: {
                userId: session.info.userId,
                dbUrl: session.info.dbUrl,
                blobName: blobRes.name
              },
              target: {
                blobName: 'profile-banner'
              }
            }
          )
          isPending = isPending || res.pending()
        }
      }
      if (!isPending) {
        toast.create('Profile updated', 'success')
        emit(this, 'profile-updated')
      } else {
        toast.create('Updates processing')
      }
      this.isProcessing = false
      this.hasChanges = false
      this.customUIOverride = undefined
    } catch (e) {
      this.isProcessing = false
      this.currentError = e.toString()
      console.error(e)
    }
  }
}

customElements.define('app-edit-profile', EditProfile)


function hasChanges (left, right) {
  let keys = Array.from(new Set(Object.keys(left).concat(Object.keys(right))))
  for (let k of keys) {
    if (typeof left[k] !== typeof right[k]) {
      return true
    }
    if (typeof left[k] === 'object' || Array.isArray(left[k])) {
      if (hasChanges(left[k], right[k])) {
        return true
      }
    }
    if (left[k] !== right[k]) {
      return true
    }
  }
  return false
}

async function uploadBlob (blobName, dataUrl) {
  let {base64buf, mimeType} = images.parseDataUrl(dataUrl)
  let res, lastError
  for (let i = 1; i < 6; i++) {
    try {
      if (blobName) {
        res = await session.ctzn.blob.update(blobName, base64buf, {mimeType})
      } else {
        res = await session.ctzn.blob.create(base64buf, {mimeType})
      }
    } catch (e) {
      lastError = e
      let shrunkDataUrl = await images.shrinkImage(dataUrl, (10 - i) / 10, mimeType)
      let parsed = images.parseDataUrl(shrunkDataUrl)
      base64buf = parsed.base64buf
      mimeType = parsed.mimeType
    }
  }
  if (!res) {
    console.error(lastError)
    throw new Error(`Failed to upload ${blobName}: ${lastError.toString()}`)
  }
  return res
}

function getByPath (obj, path) {
  for (let k of path) {
    if (typeof obj[k] === 'object') {
      obj = obj[k]
    } else {
      return undefined
    }
  }
  return obj
}

function setByPath (obj, path, v) {
  for (let k of path.slice(0, -1)) {
    if (typeof obj[k] === 'object') {
      obj = obj[k]
    } else {
      obj[k] = {}
      obj = obj[k]
    }
  }
  obj[path[path.length - 1]] = v
}