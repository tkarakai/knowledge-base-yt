"use client"

import * as React from "react"

/** Module-level state shared across all hook consumers on the same page. */
let isOnline = true
const listeners = new Set<() => void>()
let refCount = 0
let abortController: AbortController | null = null

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

async function checkConnectivity() {
  if (!navigator.onLine) {
    if (isOnline) {
      isOnline = false
      notify()
    }
    return
  }

  abortController?.abort()
  abortController = new AbortController()

  try {
    await fetch(`/favicon.ico?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: abortController.signal,
    })
    if (!isOnline) {
      isOnline = true
      notify()
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
    if (isOnline) {
      isOnline = false
      notify()
    }
  }
}

function handleOnline() {
  // Browser says we're online — verify with a real fetch to catch captive portals
  checkConnectivity()
}

function handleOffline() {
  isOnline = false
  notify()
}

function startListening() {
  isOnline = navigator.onLine
  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)
  checkConnectivity()
}

function stopListening() {
  window.removeEventListener("online", handleOnline)
  window.removeEventListener("offline", handleOffline)
  abortController?.abort()
  abortController = null
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  refCount++
  if (refCount === 1) {
    startListening()
  }
  return () => {
    listeners.delete(callback)
    refCount--
    if (refCount === 0) {
      stopListening()
    }
  }
}

function getSnapshot() {
  return isOnline
}

function getServerSnapshot() {
  return true
}

/**
 * Returns `true` if the browser has network connectivity.
 *
 * Event-driven: listens for `online`/`offline` browser events and verifies
 * transitions with a HEAD fetch to catch false-positive states (e.g. captive
 * portals). No continuous polling — reacts only to browser network events.
 *
 * SSR-safe: always returns `true` on the server.
 * Multiple consumers share a single listener via a module-level singleton.
 */
export function useNetworkStatus(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
