import * as session from './session.js'
import * as toast from '../com/toast.js'

// exported api
// =

class DbmethodCall {
  constructor (response) {
    this.hydrate(response)
    if (this.pending()) {
      trackPendingCall(this)
    }
  }

  hydrate (response) {
    this.__response = response
    if (response?.result) {
      for (let k in response?.result) {
        this[k] = response?.result[k]
      }
    }
  }

  async checkResult ({wait, timeout} = {}) {
    if (!this.pending()) {
      return true
    }
    const res = await session.api.dbmethod.getResult({
      call: this.__response.key,
      wait,
      timeout
    })
    if (res) {
      this.hydrate(res)
      return true
    }
    return false
  }

  success () {
    return !this.failed() && !this.pending()
  }

  failed () {
    return !this.pending() && this.__response.result.code !== 'success'
  }

  pending () {
    return !this.__response.result
  }
}

export async function call (database, method, args, opts = undefined) {
  const res = await session.api.dbmethod.call({
    database,
    method,
    args,
    wait: false
  })
  if (res.result && res.result.code !== 'success') {
    throw new MethodCallError(method, res.result)
  }
  const wrappedRes = new DbmethodCall(res)
  if (wrappedRes.pending() && !opts?.quiet) {
    toast.create('Your request is being processed')
  }
  return wrappedRes
}

export function listPendingCalls () {
  return readFromLS()
}

export function untrackPendingCall (call) {
  const calls = readFromLS()
  let i = calls.findIndex(c => c.__response.key === call.__response.key)
  if (i !== -1) calls.splice(i, 1)
  writeToLS(calls)
}

// internal methods
// =

function trackPendingCall (call) {
  const calls = readFromLS()
  calls.push(call)
  writeToLS(calls)
}

function readFromLS () {
  let calls = []
  try { calls = JSON.parse(localStorage.getItem('pending-dbmethod-calls')) }
  catch (e) {}
  return calls.map(response => new DbmethodCall(response))
}

function writeToLS (calls) {
  localStorage.setItem('pending-dbmethod-calls', JSON.stringify(calls.map(c => c.__response), null, 2))
}

class MethodCallError extends Error {
  constructor (method, result) {
    super(result.details?.message || result.code)
    this.method = method
    this.code = result.code
    this.details = result.details
  }
}