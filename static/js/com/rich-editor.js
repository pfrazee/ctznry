import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

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
      toolbar: 'undo redo | formatselect | ' +
      'bold italic underline strikethrough | link | bullist numlist outdent indent | ' +
      'table tabledelete | removeformat',
      
      custom_elements: 'ctzn-post-view',
      setup: (editor) => {
        editor.ui.registry.addIcon('ctzn-post-view', '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M19 4a2 2 0 1 1-1.854 2.751L15 6.75c-1.239 0-1.85.61-2.586 2.31l-.3.724c-.42 1.014-.795 1.738-1.246 2.217.406.43.751 1.06 1.12 1.92l.426 1.018c.704 1.626 1.294 2.256 2.428 2.307l.158.004h2.145a2 2 0 1 1 0 1.501L15 18.75l-.219-.004c-1.863-.072-2.821-1.086-3.742-3.208l-.49-1.17c-.513-1.163-.87-1.57-1.44-1.614L9 12.75l-2.146.001a2 2 0 1 1 0-1.501H9c.636 0 1.004-.383 1.548-1.619l.385-.92c.955-2.291 1.913-3.382 3.848-3.457L15 5.25h2.145A2 2 0 0 1 19 4z" fill-rule="evenodd"/></svg>');
        editor.on('PreInit', () => {
          const win = editor.getWin();
          const doc = editor.getDoc();
          setupWebComponent(win, doc, editor);
          editor.serializer.addNodeFilter('ctzn-post-view', (nodes) => {
            nodes.forEach((node) => {
              if (!!node.attr('contenteditable')) {
                node.attr('contenteditable', null)
                node.firstChild.unwrap()
              }
            })
          })
        })
        editor.ui.registry.addButton('ctzn-post-view', {
          icon: 'ctzn-post-view',
          tooltip: 'Insert embedded post',
          onAction: () => {
            dialogManager(null, editor);
          }
        });
      },
    })
    // Add more to your post! This is optional, and there's no character limit.
    
    // Our custom function for setting up the Web Component.
    // Read more about web components here:
    // https://developer.mozilla.org/en-US/docs/Web/Web_Components
    const setupWebComponent = (win, doc, editor) => {
      // the shadow root gets it's HTML content from the template element.
      // We do not need to inject the template element into the content,
      // we can simply create it in memory and attach it to the shadow root
      const template = doc.createElement('template');
      
      template.innerHTML = `
      <style>
      /* The host selector targets the shadow DOM host element
      * https://developer.mozilla.org/en-US/docs/Web/CSS/:host()
      */
      :host {
        display: block; /* Required to get block behavior inside TinyMCE */
        background-color: rgba(240, 210, 140, .20);
        border-radius: 6px;
      }
      header {
        display: flex;
        padding: 4px 6px;
        margin: 0;
        background-color: rgba(240, 210, 140, .20);
        border-radius: 6px 6px 0 0;
      }
      header p {
        margin: 0;
        line-height: 24px;
        font-size: 14px;
        color: #B7974C;
      }
      header > svg {
        fill: #B7974C;
        margin-right: 6px;
      }
      span#property {
        font-weight: bold;
      }
      span#value {
        font-weight: bold;
      }
      button {
        background: rgba(240, 210, 140, .5);
        border: 0;
        outline: 0;
        -webkit-tap-highlight-color: rgba(0,0,0,0);
        -webkit-user-select: none;
        user-select: none;
        font-weight: normal;
        padding: 6px;
        margin: 0 0 0 10px;
        border-radius: 6px;
      }
      button svg {
        fill: #B7974C;
        display: block;
      }
      button:hover {
        background-color: rgba(240, 210, 140, .75);
      }
      .content {
        margin: 0 6px;
        box-sizing: border-box;
        padding-bottom: 2px;
      }
      </style>
      <!--
      The web component's HTML. The <slot> will be
      replaced by the content wrapped in the <condidional-block> element.
      https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_templates_and_slots
      -->
      <header>
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M19 4a2 2 0 1 1-1.854 2.751L15 6.75c-1.239 0-1.85.61-2.586 2.31l-.3.724c-.42 1.014-.795 1.738-1.246 2.217.406.43.751 1.06 1.12 1.92l.426 1.018c.704 1.626 1.294 2.256 2.428 2.307l.158.004h2.145a2 2 0 1 1 0 1.501L15 18.75l-.219-.004c-1.863-.072-2.821-1.086-3.742-3.208l-.49-1.17c-.513-1.163-.87-1.57-1.44-1.614L9 12.75l-2.146.001a2 2 0 1 1 0-1.501H9c.636 0 1.004-.383 1.548-1.619l.385-.92c.955-2.291 1.913-3.382 3.848-3.457L15 5.25h2.145A2 2 0 0 1 19 4z" fill-rule="evenodd"/></svg>
      <p>Show block if <span id="property"></span>&nbsp;<span id="operator">&nbsp;</span>&nbsp;<span id="value"></span></p>
      <button type="button" id="btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M0 9.502v2.5h2.5l7.373-7.374-2.5-2.5L0 9.502zm11.807-6.807c.26-.26.26-.68 0-.94l-1.56-1.56a.664.664 0 0 0-.94 0l-1.22 1.22 2.5 2.5 1.22-1.22z"/></svg>
      </button>
      </header>
      <div class="content">
      <slot></slot>
      </div>
      `;
      
      // Create the conditional block custom element.
      // Familiarize yourself with web components and custom elements here:
      // https://developer.mozilla.org/en-US/docs/Web/Web_Components
      class CtznPostView extends win.HTMLElement {
        constructor() {
          super();
          
          // During the creation of the web component we set contenteditable false
          // on the web component to make it behave like a noneditable-but-selectable
          // element inside TinyMCE.
          this.setAttribute('contenteditable', false);
          
          // Attach the shadow DOM to the element
          // https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
          const shadow = this.attachShadow({mode: 'open'});
          
          // Attach the html template to the web components shadow DOM
          this.shadowRoot.appendChild(template.content.cloneNode(true));
        }
        
        connectedCallback() {
          // Make the content within <ctzn-post-view> editable by wrapping the
          // content in a <div> with contenteditable on it.
          const cleanupContentEditable = () => {
            if (this.firstChild.contentEditable !== 'true') {
              const editableWrapper = document.createElement('div');
              editableWrapper.setAttribute('contenteditable', true);
              
              while (this.firstChild) {
                editableWrapper.appendChild(this.firstChild)
              }
              
              this.appendChild(editableWrapper);
            }
          }
          cleanupContentEditable();
          
          // Open the edit dialog
          const editConditionalBlock = () => {
            dialogManager(this, editor);
            return false;
          }
          this.shadowRoot.getElementById('btn').addEventListener('click', editConditionalBlock);
        }
        
        // Everytime a custom element's attributes is added, changed or removed
        // the `attributeChangedCallback` method is invoked. Which attributes are
        // observed is defined by the `observedAttributes` method.
        attributeChangedCallback(name, oldValue, newValue) {
          if (name === 'data-property') {
            this.shadowRoot.getElementById('property').textContent = newValue;
          }
          else if (name === 'data-operator') {
            this.shadowRoot.getElementById('operator').textContent = newValue;
          }
          else if (name === 'data-value') {
            this.shadowRoot.getElementById('value').textContent = newValue;
          }
        }
        
        static get observedAttributes() { return ['data-property', 'data-operator', 'data-value']; }
        
      }
      // Register our web component to the tag we want to use it as
      // https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define
      win.customElements.define('ctzn-post-view', CtznPostView);
    }
    
    // Custom function that manages the Insert/edit dialog
    const dialogManager = (conditionalBlock, editor) => {
      // Open a TinyMCE modal where the user can set the badge's
      // background and text color.
      // https://www.tiny.cloud/docs/ui-components/dialog/
      // https://www.tiny.cloud/docs/ui-components/dialogcomponents/
      editor.windowManager.open({
        title: 'Insert/edit Conditional block',
        body: {
          type: 'panel',
          items: [
            {
              type: 'selectbox',
              name: 'property',
              label: 'Property',
              items: [
                { value: 'number_of_people', text: 'number_of_people' },
                { value: 'name_of_event', text: 'name_of_event' },
                { value: 'length_of_stay', text: 'length_of_stay' },
              ]
            }, {
              type: 'selectbox',
              name: 'operator',
              label: 'Operator',
              items: [
                { value: 'is greater than', text: 'is greater than' },
                { value: 'is equal or greater than', text: 'is equal or greater than' },
                { value: 'is equal to', text: 'is equal to' },
                { value: 'is equal or less than', text: 'is equal or less than' },
                { value: 'is less than', text: 'is less than' },
                { value: 'is not equal to', text: 'is not equal to' },
              ]
            }, {
              type: 'input',
              name: 'value',
              label: 'Value',
              placeholder: 'Value'
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
          property: conditionalBlock ? conditionalBlock.dataset.property : 'number_of_people' ,
          operator: conditionalBlock ? conditionalBlock.dataset.operator : 'is equal to',
          value: conditionalBlock ? conditionalBlock.dataset.value: ''
        },
        onSubmit: (dialog) => {
          // Get the form data.
          var data = dialog.getData();
          
          // Check if a block is edited or a new block is to be inserted
          if (!conditionalBlock) {
            // Insert content at the location of the cursor.
            // https://www.tiny.cloud/docs/api/tinymce/tinymce.editor/#insertcontent
            editor.insertContent(`<ctzn-post-view data-property="${data.property}" data-operator="${data.operator}" data-value="${data.value}"><p>Write conditional text here</p></ctzn-post-view>`);
          }
          else {
            // Working directly with the DOM often requires manually adding
            // the actions to the undo stack.
            // https://www.tiny.cloud/docs/api/tinymce/tinymce.undomanager/
            editor.undoManager.transact(() => {
              // Update the data-attributes on the conditional-block element
              conditionalBlock.dataset.property = data.property;
              conditionalBlock.dataset.operator = data.operator;
              conditionalBlock.dataset.value = data.value;
            });
            
            // Tell TinyMCE that the ui has been updated.
            // https://www.tiny.cloud/docs/api/tinymce/tinymce.editor/#nodechanged
            editor.nodeChanged();
          }
          
          // Close the dialog.
          dialog.close();
        }
      });
    }
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

/*import { LitElement, html } from '../../vendor/lit-element/lit-element.js'

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
    this.editor = undefined
  }
  
  async connectedCallback () {
    super.connectedCallback()
    await loadCKEditorAsNeeded()
    this.editor = await createCkEditor(this.querySelector('.editor'))
    // Add more to your post! This is optional, and there's no character limit.
  }
  
  disconnectedCallback () {
    super.disconnectedCallback()
    if (this.editor) {
      this.editor.destroy()
      this.editor = undefined
    }
  }
  
  get value () {
    return this.editor?.getData() || ''
  }
  
  // rendering
  // =
  
  render () {
    return html`
    <div class="editor"></div>
    `
  }
}

customElements.define('app-rich-editor', RichEditor)

let _loadPromise = undefined
function loadCKEditorAsNeeded () {
  if (typeof window.createCkEditor !== 'undefined') return
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.setAttribute('src', `/vendor/ckeditor5.js`)
    script.addEventListener('load', resolve)
    document.body.append(script)
  })
  return _loadPromise
}*/