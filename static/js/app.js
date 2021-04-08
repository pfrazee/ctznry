import { LitElement, html } from '../vendor/lit-element/lit-element.js'
import * as session from './lib/session.js'
import { emit } from './lib/dom.js'
import * as gestures from './lib/gestures.js'
import * as toast from './com/toast.js'
import * as contextMenu from './com/context-menu.js'
import { DRIVE_KEY_REGEX } from './lib/strings.js'
import { BasePopup } from './com/popups/base.js'
import './com/header.js'
import './views/account.js'
import './views/communities.js'
import './views/forgot-password.js'
import './views/main.js'
import './views/post.js'
import './views/signup.js'
import './views/user.js'

const POST_PATH_REGEX = new RegExp('/([^/]+@[^/]+)/ctzn.network/post/([^/]+)', 'i')
const COMMENT_PATH_REGEX = new RegExp('/([^/]+@[^/]+)/ctzn.network/comment/([^/]+)', 'i')
const USER_PATH_REGEX = new RegExp('/([^/]+@[^/]+)')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    /*
    TODO - disabled until we can get caching to work correctly
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch(console.error)
    */
    const registration = await navigator.serviceWorker.getRegistration('/')
    if (registration) {
      await registration.unregister()
    }
  })
}

class CtznApp extends LitElement {
  static get properties () {
    return {
      currentPath: {type: String},
      isLoading: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()

    this.isLoading = true
    this.pageHasChanges = false
    this.currentPath = window.location.pathname
    gestures.setup()
    this.setGestureNav()
    document.body.addEventListener('click', this.onGlobalClick.bind(this))
    document.body.addEventListener('view-thread', this.onViewThread.bind(this))
    document.body.addEventListener('navigate-to', this.onNavigateTo.bind(this))
    document.body.addEventListener('delete-post', this.onDeletePost.bind(this))
    document.body.addEventListener('moderator-remove-post', this.onModeratorRemovePost.bind(this))
    window.addEventListener('popstate', this.onHistoryPopstate.bind(this))
    window.addEventListener('beforeunload', this.onBeforeUnload.bind(this))

    this.load()
  }

  async load () {
    try {
      await session.setup()
    } finally {
      this.isLoading = false
    }
  }

  navigateTo (pathname, replace = false) {
    if (this.pageHasChanges) {
      if (!confirm('Lose unsaved changes?')) {
        return
      }
    }
    this.pageHasChanges = false

    contextMenu.destroy()
    BasePopup.destroy()
    
    if (history.scrollRestoration) {
      history.scrollRestoration = 'manual'
    }

    if (replace) {
      window.history.replaceState({}, null, pathname)
    } else {
      window.history.replaceState({scrollY: window.scrollY}, null)
      window.history.pushState({}, null, pathname)
    }
    this.currentPath = pathname
    this.setGestureNav()
  }

  setGestureNav () {
    switch (this.currentPath) {
      case '/':
      case '/index':
      case '/index.html':
      case '/notifications':
        gestures.setCurrentNav(['/', '/notifications'])
        return
      case '/communities':
        gestures.setCurrentNav([{back: true}, '/communities'])
        return
      default:
        // NOTE: user-view specifies the gestures nav since it uses custom UIs
        if (!USER_PATH_REGEX.test(this.currentPath)) {
          gestures.setCurrentNav(undefined)
        }
    }
    if (POST_PATH_REGEX.test(this.currentPath)) {
      gestures.setCurrentNav([{back: true}, this.currentPath])
      return
    }
    if (COMMENT_PATH_REGEX.test(this.currentPath)) {
      gestures.setCurrentNav([{back: true}, this.currentPath])
      return
    }
  }

  async scrollToAfterLoad (scrollY) {
    await this.updateComplete

    try {
      let view = this.querySelector('#view')
      view.pageLoadScrollTo(scrollY)
    } catch (e) {}
  }

  reloadView () {
    try {
      let view = this.querySelector('#view')
      view.load()
    } catch (e) {
      console.log('Failed to reload view', e)
    }
  }

  // rendering
  // =

  render () {
    if (this.isLoading) {
      return html`
        <div class="max-w-4xl mx-auto">
          <div class="py-32 text-center text-gray-400">
            <span class="spinner h-7 w-7"></span>
          </div>
        </div>
      `
    }

    switch (this.currentPath) {
      case '/':
      case '/index':
      case '/index.html':
      case '/notifications':
      case '/activity':
        return html`<app-main-view id="view" current-path=${this.currentPath}></app-main-view>`
      case '/forgot-password':
        return html`<app-forgot-password-view id="view" current-path=${this.currentPath}></app-forgot-password-view>`
      case '/communities':
        return html`<app-communities-view id="view" current-path=${this.currentPath}></app-communities-view>`
      case '/account':
        return html`<app-account-view id="view" current-path=${this.currentPath}></app-account-view>`
      case '/search':
        return html`<app-search-view id="view" current-path=${this.currentPath}></app-search-view>`
      case '/signup':
        return html`<app-signup-view id="view" current-path=${this.currentPath}></app-signup-view>`
    }
    if (POST_PATH_REGEX.test(this.currentPath)) {
      return html`<app-post-view id="view" current-path=${this.currentPath}></app-post-view>`
    }
    if (COMMENT_PATH_REGEX.test(this.currentPath)) {
      return html`<app-post-view id="view" current-path=${this.currentPath}></app-post-view>`
    }
    if (USER_PATH_REGEX.test(this.currentPath)) {
      return html`<app-user-view id="view" current-path=${this.currentPath}></app-user-view>`
    }
    return html`
      <main class="bg-gray-100 min-h-screen">
        <app-header></app-header>
        <div class="text-center py-48">
          <h2 class="text-5xl text-gray-600 font-semibold mb-4">404 Not Found</h2>
          <div class="text-lg text-gray-600 mb-4">No page exists at this URL.</div>
          <div class="text-lg text-gray-600">
            <a class="text-blue-600 hov:hover:underline" href="/" title="Back to home">
              <span class="fas fa-angle-left fa-fw"></span> Home</div>
            </a>
          </div>
        </div>
      </main>
    `
  }

  // events
  // =

  onGlobalClick (e) {
    if (e.defaultPrevented) {
      return
    }

    let anchor
    for (let el of e.composedPath()) {
      if (el.tagName === 'A') {
        anchor = el
      }
    }
    if (!anchor) return

    const href = anchor.getAttribute('href')
    if (href === null) return
    
    const url = new URL(href, window.location.origin)
    if (url.origin === window.location.origin) {
      e.preventDefault()
      this.navigateTo(url.pathname)
    }
  }

  onViewThread (e) {
    let [_, path] = e.detail.subject.dbUrl.split(DRIVE_KEY_REGEX)
    this.navigateTo(`/${e.detail.subject.authorId}${path}`)
  }

  onNavigateTo (e) {
    this.navigateTo(e.detail.url, e.detail.replace)
  }

  onHistoryPopstate (e) {
    emit(document, 'close-all-popups')
    this.currentPath = window.location.pathname
    this.setGestureNav()
    if (e.state.scrollY) {
      this.scrollToAfterLoad(e.state.scrollY)
    }
  }

  onBeforeUnload (e) {
    if (this.pageHasChanges) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  async onDeletePost (e) {
    try {
      await session.ctzn.user.table('ctzn.network/post').delete(e.detail.post.key)
      toast.create('Post deleted')
      this.reloadView()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }

  async onModeratorRemovePost (e) {
    try {
      const post = e.detail.post
      await session.ctzn.db(post.value.community.userId).method(
        'ctzn.network/community-remove-content-method',
        {contentUrl: post.url}
      )
      toast.create('Post removed')
      this.reloadView()
    } catch (e) {
      console.log(e)
      toast.create(e.toString(), 'error')
    }
  }
}

customElements.define('app-root', CtznApp)