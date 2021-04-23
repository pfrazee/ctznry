import { html } from '../../vendor/lit/lit.min.js'
import { createWidgetBaseClass } from './base.js'
import { makeSafe, parseSrcAttr } from '../lib/strings.js'

// exported api
// =

export const name = 'ctzn-comment-view'
export const validElements = 'ctzn-comment-view[src|mode]'

export function setup (win, doc, editor) {
  class CtznCommentView extends createWidgetBaseClass(win) {
    static get observedAttributes () {
      return ['mode', 'src']
    }

    get authorId () {
      if (!this.src) return ''
      try {
        return parseSrcAttr(this.src).userId
      } catch (e) {
        return ''
      }
    }

    renderHeader () {
      return html`
        <strong>Embedded Comment</strong>
        by
        <span class="link" @click=${e => this.onClickAuthor(e)}>${this.authorId}</span>
      `
    }

    renderFooter () {
      return html`
        <span class="link" @click=${e => this.onClickSrc(e)}>${this.src}</span>
      `
    }

    onClickEdit (e) {
      doPropertiesDialog(this, editor)
    }

    onClickAuthor (e) {
      e.preventDefault()
      e.stopPropagation()
      window.open(`/${this.authorId}`)
    }

    onClickSrc (e) {
      e.preventDefault()
      e.stopPropagation()
      window.open(this.src)
    }
  }
  win.customElements.define('ctzn-comment-view', CtznCommentView)
}

export function insert (editor) {
  doPropertiesDialog(null, editor)
}

// internal methods
// =

function doPropertiesDialog (el, editor) {
  editor.windowManager.open({
    title: 'Embedded comment',
    body: {
      type: 'panel',
      items: [
        {
          type: 'input',
          name: 'src',
          label: 'URL',
          placeholder: 'The URL of the comment'
        }, {
          type: 'selectbox',
          name: 'mode',
          label: 'Display Mode',
          items: [
            { value: 'default', text: 'Default' },
            { value: 'content-only', text: 'Content-only' },
          ]
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
      mode: el?.mode || 'default',
      src: el?.src || ''
    },
    onSubmit: (dialog) => {
      var data = dialog.getData()

      try {
        parseSrcAttr(data.src)
      } catch (e) {
        editor.windowManager.alert('Invalid URL. Use "Copy link" on the comment you want to embed.', function(){});
        return
      }
      
      if (!el) {
        editor.insertContent(`<ctzn-comment-view mode="${makeSafe(data.mode)}" src="${makeSafe(data.src)}"></ctzn-comment-view>`)
      }
      else {
        editor.undoManager.transact(() => {
          el.mode = data.mode
          el.src = data.src
          editor.dom.setAttribs(el, data)
        })
        editor.nodeChanged()
      }
      dialog.close()
    }
  })
}