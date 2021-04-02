import * as toast from '../com/toast.js'

// globals
// =

let currentNav = undefined

// exported api
// =

window.X_THRESH = 60
window.XN_THRESH = 2
window.Y_MAX = 500

export const events = new EventTarget()

export function setup () {
  let touchstartX = 0
  let touchstartY = 0
  document.body.addEventListener('touchstart', e => {
    for (let el of e.composedPath()) {
      if (el.scrollWidth > el.offsetWidth) {
        return
      }
    }
    
    touchstartX = e.changedTouches[0].screenX
    touchstartY = e.changedTouches[0].screenY
  }, false)
  document.body.addEventListener('touchend', e => {
    let touchendX = e.changedTouches[0].screenX
    let touchendY = e.changedTouches[0].screenY
    let diffX = touchendX - touchstartX
    let diffY = touchendY - touchstartY
    let diffXNormalized = diffX / Math.abs(diffY + 1)
    console.log(diffX, diffY, diffXNormalized)
    if (Math.abs(diffY) < window.Y_MAX) {
      if (diffX > (window.X_THRESH) && diffXNormalized > (window.XN_THRESH)) {
        toast.create(`${diffX}, ${diffY}, ${diffXNormalized}`)
        events.dispatchEvent(new Event('swipe-right'))
        moveNav(-1)
      } else if (diffX < -1 * (window.X_THRESH) && diffXNormalized < -1 * (window.XN_THRESH)) {
        toast.create(`${diffX}, ${diffY}, ${diffXNormalized}`)
        events.dispatchEvent(new Event('swipe-left'))
        moveNav(1)
      }
    }
  }, false)
}

export function setCurrentNav (nav) {
  currentNav = nav
}

// internal methods
// =

function moveNav (dir) {
  if (!currentNav) return
  const url = currentNav[getCurrentNavPosition() + dir]
  if (url?.back) {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url: '/', replace: true}}))
    }
  } else if (url) {
    document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url, replace: true}}))
  } else if (dir === -1) {
    document.body.dispatchEvent(new CustomEvent('open-main-menu'))
  }
}

function getCurrentNavPosition () {
  if (!currentNav) return
  const i = currentNav.indexOf(location.pathname)
  if (i === -1) return 0
  return i
}