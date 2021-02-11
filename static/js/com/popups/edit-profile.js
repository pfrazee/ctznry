import { html } from '../../../vendor/lit-element/lit-element.js'
import { BasePopup } from './base.js'
import '../button.js'

const CANVAS_SIZE = 200

// exported api
// =


export class EditProfilePopup extends BasePopup {
  constructor (userId, avatarUrl, profile) {
    super()
    this.userId = userId
    this.profile = profile
    this.zoom = 1
    this.avatarUrl = avatarUrl
    this.img = undefined
    this.uploadedAvatar = undefined
  }

  loadImg (url) {
    this.zoom = 1
    this.img = document.createElement('img')
    this.img.src = url
    this.img.onload = () => {
      var smallest = (this.img.width < this.img.height) ? this.img.width : this.img.height
      this.zoom = CANVAS_SIZE / smallest
      this.updateCanvas()
    }
  }

  async updateCanvas () {
    this.avatarUrl = undefined
    await this.requestUpdate()
    var canvas = document.getElementById('avatar-canvas')
    if (canvas) {
      var ctx = canvas.getContext('2d')
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.save()
      ctx.scale(this.zoom, this.zoom)
      ctx.drawImage(this.img, 0, 0, this.img.width, this.img.height)
      ctx.restore()
    }
  }

  // management
  //

  static async create (userId, avatarUrl, profile) {
    return BasePopup.create(EditProfilePopup, userId, avatarUrl, profile)
  }

  static destroy () {
    return BasePopup.destroy('ctzn-edit-profile')
  }

  // rendering
  // =

  renderTitle () {
    return `Edit your profile`
  }

  renderBody () {
    return html`
      <form @submit=${this.onSubmit}>      
        <div class="">
          ${this.avatarUrl ? html`
            <img class="block mx-auto my-4 w-48 h48 rounded-full cursor-pointer hover:opacity-50" src=${this.avatarUrl} @click=${this.onClickAvatar}>
          ` : html`
            <canvas class="block mx-auto my-4 w-48 h48 rounded-full cursor-pointer hover:opacity-50" id="avatar-canvas" width=${CANVAS_SIZE} height=${CANVAS_SIZE} @click=${this.onClickAvatar}></canvas>
          `}
          <div class="text-center mb-4">
            <ctzn-button tabindex="1" @click=${this.onClickAvatar} label="Change Avatar"></ctzn-button>
            <input class="hidden" type="file" accept=".jpg,.jpeg,.png" @change=${this.onChooseAvatarFile}>
          </div>

          <label class="block font-semibold p-1" for="displayName-input">Display Name</label>
          <input
            autofocus
            type="text"
            id="displayName-input"
            name="displayName"
            value="${this.profile.displayName}"
            class="block box-border w-full border border-gray-300 rounded p-3 mb-1"
            placeholder="Anonymous"
          />

          <label class="block font-semibold p-1" for="description-input">Bio</label>
          <textarea
            id="description-input"
            name="description"
            class="block box-border w-full border border-gray-300 rounded p-3"
          >${this.profile.description}</textarea>
        </div>

        <div class="flex justify-between mt-4">
          <ctzn-button @click=${this.onReject} tabindex="3" label="Cancel"></ctzn-button>
          <ctzn-button
            primary
            type="submit"
            tabindex="2"
            label="Save"
          ></ctzn-button>
        </div>
      </form>
    `
  }

  // events
  // =

  async onClickAvatar (e) {
    e.preventDefault()
    this.querySelector('input[type="file"]').click()
  }

  onChooseAvatarFile (e) {
    var file = e.currentTarget.files[0]
    if (!file) return
    var fr = new FileReader()
    fr.onload = () => {
      var ext = file.name.split('.').pop()
      this.loadImg(fr.result)
      var base64buf = fr.result.split(',').pop()
      this.uploadedAvatar = {ext, base64buf}
    }
    fr.readAsDataURL(file)
  }

  onSubmit (e) {
    e.preventDefault()
    e.stopPropagation()

    if (this.uploadedAvatar) {
      let dataUrl = document.getElementById('avatar-canvas').toDataURL()
      this.uploadedAvatar.ext = 'png'
      this.uploadedAvatar.base64buf = dataUrl.split(',').pop()
    }

    this.dispatchEvent(new CustomEvent('resolve', {
      detail: {
        profile: {
          displayName: e.target.displayName.value,
          description: e.target.description.value
        },
        uploadedAvatar: this.uploadedAvatar
      }
    }))
  }
}

customElements.define('ctzn-edit-profile', EditProfilePopup)