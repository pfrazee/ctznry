import { html } from '../../vendor/lit-element/lit-html/lit-html.js'
import { createWidgetBaseClass } from './base.js'
import { makeSafe } from '../lib/strings.js'

// exported api
// =

export const name = 'ctzn-posts-feed'
export const validElements = 'ctzn-posts-feed[user-id|limit]'

export function setup (win, doc, editor) {
  class CtznPostsFeed extends createWidgetBaseClass(win) {
    static get observedAttributes () {
      return ['user-id', 'limit']
    }

    renderHeader () {
      return html`
        <strong>Posts Feed</strong>
        of
        ${this['user-id'] ? html`
          <span class="link" @click=${e => this.onClickUser(e)}>${this['user-id']}</span>
        ` : html`
          this user
        `}
      `
    }

    renderFooter () {
      return html`
        ${this.limit ? `Limit: ${this.limit}` : 'Infinite scroll'}
      `
    }

    onClickEdit (e) {
      doPropertiesDialog(this, editor)
    }

    onClickUser (e) {
      e.preventDefault()
      e.stopPropagation()
      window.open(`/${this['user-id']}`)
    }
  }
  win.customElements.define('ctzn-posts-feed', CtznPostsFeed)
}

export function insert (editor) {
  doPropertiesDialog(null, editor)
}

// internal methods
// =

function doPropertiesDialog (el, editor) {
  editor.windowManager.open({
    title: 'Posts feed',
    body: {
      type: 'panel',
      items: [
        {
          type: 'input',
          name: 'user-id',
          label: 'User ID',
          placeholder: 'Whose feed to show? (Optional, defaults to the profile being viewed.)'
        },
        {
          type: 'input',
          name: 'limit',
          label: 'Posts limit',
          placeholder: 'How many posts should we show? (Optional, defaults to infinite scroll.)'
        }
      ]
    },
    buttons: [
      {
        type: 'cancel',
        name: 'closeButton',
        text: 'Cancel'
      },
      {
        type: 'submit',
        name: 'submitButton',
        text: 'Save',
        primary: true
      }
    ],
    initialData: {
      'user-id': el?.['user-id'] || '',
      limit: el?.limit || ''
    },
    onSubmit: (dialog) => {
      var data = dialog.getData()

      data.limit = parseInt(data.limit) || ''
      
      if (!el) {
        let attrs = []
        if (data['user-id']) attrs.push(`user-id="${makeSafe(data['user-id'])}"`)
        if (data.limit) attrs.push(`limit="${makeSafe(data.limit)}"`)
        editor.insertContent(`<ctzn-posts-feed ${attrs.join(' ')}></ctzn-posts-feed>`)
      }
      else {
        editor.undoManager.transact(() => {
          if (!data['user-id']) delete data['user-id']
          else el['user-id'] = data['user-id']
          if (!data['limit']) delete data['limit']
          else el.limit = data.limit
          editor.dom.setAttribs(el, data)
        })
        editor.nodeChanged()
      }
      dialog.close()
    }
  })
}