import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

import * as postView from '../ctzn-tags-editor/post-view.js'
import * as commentView from '../ctzn-tags-editor/comment-view.js'
import * as iframe from '../ctzn-tags-editor/iframe.js'

const POST_TAGS = [
  postView,
  commentView,
  iframe
]

export class RichEditor extends LitElement {
  static get properties () {
    return {
    }
  }
  
  createRenderRoot() {
    return this // dont use shadow dom
  }
  
  constructor () {
    super()
    this.id = 'tinymce-editor-' + Date.now()
  }
  
  async connectedCallback () {
    super.connectedCallback()
    await loadTinyMCEAsNeeded()
    tinymce.init({
      target: this.querySelector('.editor'),
      menubar: false,
      plugins: [
        'advlist autolink lists link image charmap',
        'visualblocks code fullscreen',
        'media table paste code noneditable'
      ],
      toolbar: 'undo redo | post-embeds | formatselect | ' +
      'bold italic underline strikethrough | link | bullist numlist outdent indent | ' +
      'table tabledelete | removeformat',
      
      custom_elements: POST_TAGS.map(t => t.name).join(','),
      extended_valid_elements: POST_TAGS.map(t => t.validElements).filter(Boolean).join(','),

      setup: (editor) => {
        editor.on('PreInit', () => {
          const win = editor.getWin()
          const doc = editor.getDoc()
          
          for (let tag of POST_TAGS) {
            tag.setup(win, doc, editor)
            editor.serializer.addNodeFilter(tag.name, contentEditableFilter)
          }
        })
        editor.ui.registry.addMenuButton('post-embeds', {
          icon: 'image',
          tooltip: 'Insert media',
          fetch: cb => {
            cb([
              {type: 'menuitem', text: 'Embedded Post', onAction: () => postView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Comment', onAction: () => commentView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Page (iframe)', onAction: () => iframe.insert(editor)},
            ])
          }
        })
      }
    })
    // Add more to your post! This is optional, and there's no character limit.
  }
  
  disconnectedCallback () {
    super.disconnectedCallback()
    this.editor?.destroy()
  }
  
  get editor () {
    return tinymce.get(this.id)
  }
  
  get value () {
    return this.editor?.getContent() || ''
  }
  
  // rendering
  // =
  
  render () {
    return html`
      <div id=${this.id} class="editor"></div>
    `
  }
}

customElements.define('app-rich-editor', RichEditor)

// this filter ensures that the custom tags dont have contenteditable put on them by tinymce
function contentEditableFilter (nodes) {
  nodes.forEach((node) => {
    if (!!node.attr('contenteditable')) {
      node.attr('contenteditable', null)
      node.firstChild.unwrap()
    }
  })
}

let _loadPromise = undefined
function loadTinyMCEAsNeeded () {
  if (typeof window.tinymce !== 'undefined') return
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.setAttribute('src', `/vendor/tinymce/tinymce.min.js`)
    script.addEventListener('load', resolve)
    document.body.append(script)
  })
  return _loadPromise
}
