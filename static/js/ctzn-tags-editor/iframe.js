import { html } from '../../vendor/lit-element/lit-html/lit-html.js'
import { createBaseClass } from './base.js'
import { makeSafe } from '../lib/strings.js'

const penSvg = html`<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="pen" class="svg-inline--fa fa-pen fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M290.74 93.24l128.02 128.02-277.99 277.99-114.14 12.6C11.35 513.54-1.56 500.62.14 485.34l12.7-114.22 277.9-277.88zm207.2-19.06l-60.11-60.11c-18.75-18.75-49.16-18.75-67.91 0l-56.55 56.55 128.02 128.02 56.55-56.55c18.75-18.76 18.75-49.16 0-67.91z"></path></svg>`

// exported api
// =

export const name = 'ctzn-iframe'
export const validElements = 'ctzn-iframe[src]'

export function setup (win, doc, editor) {
  class CtznIframe extends createBaseClass(win) {
    static get observedAttributes () {
      return ['src']
    }

    render () {
      return html`
        <style>
        :host {
          display: block;
          background: #fff;
          border-radius: 6px;
          border: 1px solid #ccc;
          padding: 1rem;
          box-shadow: 0 2px 4px #0001;
        }
        footer {
          font-size: 90%;
        }
        .link {
          color: blue;
          text-decoration: none;
          cursor: pointer;
        }
        .link:hover {
          text-decoration: underline;
        }
        footer .link {
          color: gray;
        }
        .btn {
          display: inline-block;
          cursor: pointer;
          border-radius: 4px;
          padding: 0 8px;
        }
        .btn:hover {
          background: #eee;
        }
        .btn svg {
          width: 12px;
          color: #666;
        }
        </style>
        <header>
          <strong>Embedded Page (iframe)</strong>
          <span class="btn" @click=${e => this.onClickEdit(e)}>${penSvg}</span>
        </header>
        <footer>
          <span class="link" @click=${e => this.onClickSrc(e)}>${this.src}</span>
        </footer>
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
  win.customElements.define('ctzn-iframe', CtznIframe)
}

export function insert (editor) {
  doPropertiesDialog(null, editor)
}

// internal methods
// =

function doPropertiesDialog (el, editor) {
  editor.windowManager.open({
    title: 'Embedded page (iframe)',
    body: {
      type: 'panel',
      items: [
        {
          type: 'input',
          name: 'src',
          label: 'URL',
          placeholder: 'The URL of the page'
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
      src: el ? el.src: ''
    },
    onSubmit: (dialog) => {
      var data = dialog.getData()

      try {
        new URL(data.src)
      } catch (e) {
        editor.windowManager.alert('Invalid URL. Make sure you copied the link correctly!', function(){});
        return
      }
      
      if (!el) {
        editor.insertContent(`<ctzn-iframe src="${makeSafe(data.src)}"></ctzn-iframe>`)
      }
      else {
        editor.undoManager.transact(() => {
          el.src = data.src
          editor.dom.setAttribs(el, data)
        })
        editor.nodeChanged()
      }
      dialog.close()
    }
  })
}