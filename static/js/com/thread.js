import { LitElement, html } from '../../vendor/lit-element/lit-element.js'
import { repeat } from '../../vendor/lit-element/lit-html/directives/repeat.js'
import css from '../../css/com/thread.css.js'
import * as toast from './toast.js'
import * as session from '../lib/session.js'
import { getPost, getComment, getThread } from '../lib/getters.js'
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
      isCommenting: {type: Boolean}
    }
  }

  static get styles () {
    return css
  }

  constructor () {
    super()
    this.subject = undefined
    this.isFullPage = false
    this.setDocumentTitle = false
    this.commentCount = 0
    this.post = undefined
    this.thread = undefined
    this.isCommenting = false
    this.isLoading = false
  }

  reset () {
    this.post = undefined
    this.thread = undefined
    this.commentCount = 0
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
      if (this.subjectSchemaId === 'ctzn.network/post') {
        this.post = await getPost(this.subject.authorId, this.subject.dbUrl)
        this.thread = await getThread(this.subject.authorId, this.subject.dbUrl)
      } else if (this.subjectSchemaId === 'ctzn.network/comment') {
        let comment = await getComment(this.subject.authorId, this.subject.dbUrl)
        this.post = await getPost(comment.value.subject.authorId, comment.value.subject.dbUrl)
        this.thread = await getThread(comment.value.subject.authorId, comment.value.subject.dbUrl)
      }
    } catch (e) {
      toast.create(e.message, 'error')
      console.error(e)
    }
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
      this.shadowRoot.querySelector('.highlight').scrollIntoView()
    } catch {}
  }

  // rendering
  // =

  render () {
    return html`
      <div class="item ${this.subject.dbUrl === this.post?.url ? 'highlight' : ''}">
        ${this.post ? html`
          <ctzn-post
            .post=${this.post}
            noborders
            view-content-on-click
            @publish-reply=${this.onPublishReply}
          ></ctzn-post>
          ${this.subject.dbUrl === this.post?.url ? this.renderCommentBox() : ''}
        ` : html`
          <span class="spinner"></span>
        `}
      </div>
      ${this.thread ? html`
        <div class="comments">
          ${this.renderReplies(this.thread)}
        </div>
      ` : ''}
    `
  }

  renderReplies (replies) {
    if (!replies?.length) return ''
    return html`
      <div class="replies">
        ${repeat(replies, r => r.url, reply => {
          const isSubject = this.subject.dbUrl === reply.url
          return html`
          <div class="item ${isSubject ? 'highlight' : ''}">
              <ctzn-post
                .post=${reply}
                noborders
                thread-view
                @publish-reply=${this.onPublishReply}
              ></ctzn-post>
              ${isSubject ? this.renderCommentBox() : ''}
            </div>
            ${reply.replies?.length ? this.renderReplies(reply.replies) : ''}
          `
        })}
      </div>
    `
  }

  renderCommentBox () {
    return html`
      <div class="comment-box">
        ${this.isCommenting ? html`
          <ctzn-composer
            .subject=${{dbUrl: this.post.url, authorId: this.post.author.userId}}
            .parent=${this.subject}
            placeholder="Write your comment"
            @publish=${this.onPublishComment}
            @cancel=${this.onCancelComment}
          ></ctzn-composer>
        ` : html`
          <div class="comment-prompt" @click=${this.onStartComment}>
            Write your comment
          </div>
        `}
      </div>
    `
  }

  // events
  // =

  onStartComment (e) {
    this.isCommenting = true
  }

  onPublishComment (e) {
    toast.create('Comment published', '', 10e3)
    console.log(1)
    this.load()
    this.isCommenting = false
  }

  onCancelComment (e) {
    this.isCommenting = false
  }
  
  onPublishReply (e) {
    toast.create('Reply published', '', 10e3)
    this.load()
  }
}

customElements.define('ctzn-thread', Thread)