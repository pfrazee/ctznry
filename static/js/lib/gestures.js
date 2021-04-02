// globals
// =

let currentNav = undefined

// exported api
// =

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
    if (diffX > 60 && diffXNormalized > 2) {
      events.dispatchEvent(new Event('swipe-right'))
      moveNav(-1)
    } else if (diffX < -60 && diffXNormalized < -2) {
      events.dispatchEvent(new Event('swipe-left'))
      moveNav(1)
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
  if (url) {
    document.body.dispatchEvent(new CustomEvent('navigate-to', {detail: {url}}))
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