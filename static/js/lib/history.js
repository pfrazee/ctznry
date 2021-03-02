let _handler = undefined

export function setup () {
  window.addEventListener('popstate', e => {
    if (_handler) {
      _handler()
      _handler = undefined
    } else {
      location.reload()
    }
  }, {capture: false})
}

export function setPopHandler (handler) {
  _handler = handler
}