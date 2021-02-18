import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import * as toast from './toast.js'
import { getPost, getThread } from '../lib/getters.js'
import { emit } from '../lib/dom.js'
import * as session from '../lib/session.js'
import * as displayNames from '../lib/display-names.js'
import './post.js'
import './composer.js'

export class Thread extends LitElement {
  static get properties () {
    return {
      subject: {type: Object},
      isFullPage: {type: Boolean, attribute: 'full-page'},
      setDocumentTitle: {type: Boolean, attribute: 'set-document-title'},
      post: {type: Object},
      thread: {type: Array},
      isReplying: {type: Boolean}
    }
  }

  createRenderRoot() {
    return this // dont use shadow dom
  }

  constructor () {
    super()
    this.subject = undefined
    this.isFullPage = false
    this.setDocumentTitle = false
    this.replyCount = 0
    this.post = undefined
    this.thread = undefined
    this.isReplying = false
    this.isLoading = false
  }

  reset () {
    this.post = undefined
    this.thread = undefined
    this.replyCount = 0
  }

  get subjectSchemaId () {
    const urlp = new URL(this.subject.dbUrl)
    const pathParts = urlp.pathname.split('/')
    return pathParts.slice(3, -1).join('/')
  }

  async load () {
    this.isLoading = true
    // this.reset() TODO causes a flash of the loading spinner, needed?
    console.log('loading', this.subject)
    try {
      let post = await getPost(this.subject.authorId, this.subject.dbUrl)
      if (post.value.reply) {
        this.post = await getPost(post.value.reply.root.authorId, post.value.reply.root.dbUrl)
        this.thread = await getThread(post.value.reply.root.authorId, post.value.reply.root.dbUrl)
      } else {
        this.post = post
        this.thread = await getThread(this.subject.authorId, this.subject.dbUrl)
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
    }
    await this.updateComplete
    emit(this, 'load')
    console.log(this.post)
    console.log(this.thread)
    this.isLoading = false
  }

  updated (changedProperties) {
    if (typeof this.post === 'undefined' && !this.isLoading) {
      this.load()
    } else if (changedProperties.has('subject') && changedProperties.get('subject') != this.subject) {
      this.load()
    }
  }

  scrollHighlightedPostIntoView () {
    try {
      this.querySelector('.highlight').scrollIntoView()
    } catch (e) { console.log(e) }
  }

  // rendering
  // =

  render () {
    return html`
      <div
        class="border mb-1 ${this.subject.dbUrl === this.post?.url ? 'highlight bg-indigo-50 border-indigo-300' : 'border-gray-200'} ${this.post?.error ? 'bg-gray-50' : ''}"
      >
        ${this.post ? html`
          <ctzn-post
            .post=${this.post}
            hover-bg-color=${this.subject.dbUrl === this.post?.url ? 'indigo-100' : 'gray-50'}
            noborders
            view-content-on-click
            @publish-reply=${this.onPublishReply}
          ></ctzn-post>
          ${this.subject.dbUrl === this.post?.url ? this.renderReplyBox() : ''}
        ` : html`
          <span class="spinner"></span>
        `}
      </div>
      ${this.thread ? html`
        <div class="pl-1 border-l border-gray-200">
          ${this.renderReplies(this.thread)}
        </div>
      ` : ''}
    `
  }

  renderReplies (replies) {
    if (replies?.error) {
      return html`
        <div class="pl-1 py-2 border-l border-gray-200">
          <div class="font-semibold text-gray-500">
            <span class="fas fa-fw fa-exclamation-circle"></span>
            Failed to load thread
          </div>
          ${replies.message ? html`
            <div class="pl-6 text-sm text-gray-400">
              ${replies.message}
            </div>
          ` : ''}
        </div>
      `
    }
    if (!replies?.length) return ''
    return html`
      <div class="pl-1 border-l border-gray-200">
        ${repeat(replies, r => r.url, reply => {
          const isSubject = this.subject.dbUrl === reply.url
          return html`
          <div class="border mb-1 ${isSubject ? 'highlight bg-indigo-50 border-indigo-300' : 'border-gray-200'}">
              <ctzn-post
                .post=${reply}
                hover-bg-color=${isSubject ? 'indigo-100' : 'gray-50'}
                noborders
                nocommunity
                thread-view
                @publish-reply=${this.onPublishReply}
              ></ctzn-post>
              ${isSubject ? this.renderReplyBox() : ''}
            </div>
            ${reply.replies?.length ? this.renderReplies(reply.replies) : ''}
          `
        })}
      </div>
    `
  }

  renderReplyBox () {
    if (this.post?.value.community) {
      if (!session.isInCommunity(this.post.value.community.userId)) {
        return html`
          <div class="bg-white border-t border-indigo-300 py-2 px-3">
            <div class="italic text-gray-500 text-sm">
              Join <a href="/${this.post.value.community.userId}" class="hover:underline">${displayNames.render(this.post.value.community.userId)}</a> to reply.
            </div>
          </div>
        `
      }
    } else {
      if (!session.isFollowingMe(this.post.author.userId)) {
        return html`
          <div class="bg-white border-t border-indigo-300 py-2 px-3">
            <div class="italic text-gray-500 text-sm">
              Only people followed by <a href="/${this.post.author.userId}" class="hover:underline">${this.post.author.displayName}</a> can reply.
            </div>
          </div>
        `
      }
    }
    return html`
      <div class="bg-white border-t border-indigo-300 pb-2 pr-3">
        ${this.isReplying ? html`
          <ctzn-composer
            autofocus
            .subject=${{dbUrl: this.post.url, authorId: this.post.author.userId, community: this.post.value.community}}
            .parent=${this.subject}
            placeholder="Write your reply"
            @publish=${this.onPublishReply}
            @cancel=${this.onCancelReply}
          ></ctzn-composer>
        ` : html`
          <div class="cursor-text pt-2 pl-3 italic text-gray-500" @click=${this.onStartReply}>
            Write your reply
          </div>
        `}
      </div>
    `
  }

  // events
  // =

  onStartReply (e) {
    this.isReplying = true
  }

  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
    this.isReplying = false
  }

  onCancelReply (e) {
    this.isReplying = false
  }
}

customElements.define('ctzn-thread', Thread)