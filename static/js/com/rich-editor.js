import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

import * as postView from '../ctzn-tags-editor/post-view.js'
import * as postsFeed from '../ctzn-tags-editor/posts-feed.js'
import * as commentView from '../ctzn-tags-editor/comment-view.js'
import * as commentsFeed from '../ctzn-tags-editor/comments-feed.js'
import * as iframe from '../ctzn-tags-editor/iframe.js'
import * as code from '../ctzn-tags-editor/code.js'

const POST_TAGS = [
  postView,
  commentView,
  iframe,
  code
]
const PROFILE_TAGS = [
  postView,
  postsFeed,
  commentView,
  commentsFeed,
  iframe,
  code
]

export class RichEditor extends LitElement {
  static get properties () {
    return {
      context: {type: String},
      editorHeight: {type: String, attribute: 'editor-height'}
    }
  }
  
  createRenderRoot() {
    return this // dont use shadow dom
  }
  
  constructor () {
    super()
    this.id = 'tinymce-editor-' + Date.now()
    this.initialValue = ''
    this.context = ''
    this.editorHeight = '400px'
  }

  get supportedTags () {
    if (this.context === 'post') {
      return POST_TAGS
    }
    if (this.context === 'profile') {
      return PROFILE_TAGS
    }
    return []
  }

  get editorToolbar () {
    if (this.context === 'post') {
      return 'undo redo | formatselect | bold italic underline strikethrough | link | post-embeds | bullist numlist | ctzn-code | table | removeformat | code'
    }
    if (this.context === 'profile') {
      return 'undo redo | formatselect | bold italic underline strikethrough | link | profile-embeds | bullist numlist | ctzn-code | table | removeformat | code'
    }
  }

  get editorContentStyle () {
    const bg = (this.context === 'profile') ? '#E5E7EB' : '#FFF'
    return `
      body {
        margin: 0.6rem 0.7rem;
        background: ${bg};
      }
      h1,
      h2,
      h3,
      h4,
      h5,
      h6,
      p,
      ul,
      ol,
      table,
      blockquote,
      figcaption,
      dl {
        margin: 0 0 0.75rem;
      }
      h1 {
        font-size: 1.2rem;
        line-height: 1.75rem;
        font-weight: 700;
      }
      h2 {
        font-size: 1.15rem;
        line-height: 1.6rem;
        font-weight: 700;
      }
      h3 {
        font-size: 1.1rem;
        line-height: 1.5rem;
        font-weight: 700;
      }
      h4 {
        font-size: 1.05rem;
        line-height: 1.4rem;
        font-weight: 600;
      }
      h5 {
        font-size: 1.0rem;
        line-height: 1.4rem;
        font-weight: 600;
      }
      h6 {
        font-size: 1.0rem;
        line-height: 1.4rem;
        font-weight: 500;
      }
      *[ctzn-elem="1"] {
        display: block;
        margin-bottom: 0.25rem;
      }
      *[ctzn-elem="1"] + *:not([ctzn-elem="1"]) {
        margin-top: 0.75rem;
      }
    `
  }
  
  async connectedCallback () {
    super.connectedCallback()
    await loadTinyMCEAsNeeded()
    tinymce.init({
      target: this.querySelector('.editor'),
      placeholder: this.getAttribute('placeholder') || '',
      content_style: this.editorContentStyle,
      height: this.editorHeight,
      menubar: false,
      plugins: [
        'advlist autolink lists link image charmap',
        'visualblocks code fullscreen',
        'media table paste code noneditable'
      ],
      toolbar: this.editorToolbar,
      statusbar: false,
      formats: {
        strikethrough: { inline: 'del' }
      },
      
      custom_elements: this.supportedTags.map(t => t.name).join(','),
      extended_valid_elements: this.supportedTags.map(t => t.validElements).filter(Boolean).join(','),
      valid_children: 'ctzn-code[pre,#text]',

      setup: (editor) => {
        editor.on('PreInit', () => {
          const win = editor.getWin()
          const doc = editor.getDoc()
          
          for (let tag of this.supportedTags) {
            tag.setup(win, doc, editor)
            editor.serializer.addNodeFilter(tag.name, contentEditableFilter)
          }
        })
        editor.ui.registry.addButton('ctzn-code', {
          icon: 'code-sample',
          tooltip: 'Code snippet',
          onAction: () => code.insert(editor)
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
        editor.ui.registry.addMenuButton('profile-embeds', {
          icon: 'image',
          tooltip: 'Insert media',
          fetch: cb => {
            cb([
              {type: 'menuitem', text: 'Posts Feed', onAction: () => postsFeed.insert(editor)},
              {type: 'menuitem', text: 'Comments Feed', onAction: () => commentsFeed.insert(editor)},
              {type: 'separator'},
              {type: 'menuitem', text: 'Embedded Post', onAction: () => postView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Comment', onAction: () => commentView.insert(editor)},
              {type: 'menuitem', text: 'Embedded Page (iframe)', onAction: () => iframe.insert(editor)},
            ])
          }
        })
        editor.on('init', () => {
          if (this.initialValue) {
            editor.setContent(this.initialValue, {format: 'html'})
          }
        })
      }
    })
  }
  
  disconnectedCallback () {
    super.disconnectedCallback()
    this.editor?.destroy()
  }
  
  get editor () {
    return window.tinymce?.get(this.id)
  }
  
  get value () {
    return this.editor?.getContent() || ''
  }

  set value (v) {
    if (this.editor) {
      console.log('setting value', this.initialValue)
      this.editor.setContent(v, {format: 'html'})
    } else {
      this.initialValue = v
    }
  }
  
  // rendering
  // =
  
  render () {
    return html`
      <div id=${this.id} class="editor"></div>
      <p class="text-xs pt-0.5 pl-0.5">
        Powered by <a class="text-blue-600 hov:hover:underline" href="https://www.tiny.cloud" target="_blank">Tiny</a>
      </p>
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
