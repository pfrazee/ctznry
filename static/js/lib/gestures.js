// we put the constants on window so that mobile debuggers can tweak the values
window.SWIPE_X_THRESH = 60
window.SWIPE_XN_THRESH = 2
window.SWIPE_Y_MAX = 500
window.SWIPE_TS_MAX = 1000
window.SWIPE_LOG = false

// globals
// =

let currentNav = undefined

// exported api
// =

export const events = new EventTarget()

export function setup () {
  let touchstartTs = undefined
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
    touchstartTs = Date.now()
  }, false)
  document.body.addEventListener('touchend', e => {
    let touchendX = e.changedTouches[0].screenX
    let touchendY = e.changedTouches[0].screenY
    let diffX = touchendX - touchstartX
    let diffY = touchendY - touchstartY
    let diffXNormalized = diffX / Math.abs(diffY + 1)
    let diffTs = Date.now() - touchstartTs
    if (window.SWIPE_LOG) {
      console.log({diffX, diffY, diffXNormalized, diffTs})
    }
    if (diffTs > window.SWIPE_TS_MAX) {
      return
    }
    if (Math.abs(diffY) < window.SWIPE_Y_MAX) {
      if (diffX > (window.SWIPE_X_THRESH) && diffXNormalized > (window.SWIPE_XN_THRESH)) {
        events.dispatchEvent(new Event('swipe-right'))
        moveNav(-1)
      } else if (diffX < -1 * (window.SWIPE_X_THRESH) && diffXNormalized < -1 * (window.SWIPE_XN_THRESH)) {
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