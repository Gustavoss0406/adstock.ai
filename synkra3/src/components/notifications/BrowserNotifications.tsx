"use client"

import { useEffect, useCallback } from "react"

/**
 * Hook que gerencia permissões e exibição de notificações do navegador.
 * Usado para alertar o usuário sobre eventos da daily mesmo com o app em segundo plano.
 */

let permissionGranted = false
let permissionDenied = false

function requestPermission(): Promise<boolean> {
  if (!("Notification" in window)) return Promise.resolve(false)
  if (permissionGranted) return Promise.resolve(true)
  if (permissionDenied) return Promise.resolve(false)

  if (Notification.permission === "granted") {
    permissionGranted = true
    return Promise.resolve(true)
  }

  if (Notification.permission === "denied") {
    permissionDenied = true
    return Promise.resolve(false)
  }

  return Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      permissionGranted = true
      return true
    }
    permissionDenied = true
    return false
  })
}

export function notifyBrowser(title: string, options?: NotificationOptions & { onClick?: () => void }) {
  if (!permissionGranted) return

  try {
    const { onClick, ...notifOptions } = options || {}
    const notification = new Notification(title, {
      icon: "/agents/Maya.png",
      badge: "/agents/Maya.png",
      tag: "agencyos-daily",
      requireInteraction: false,
      ...notifOptions,
    })

    if (onClick) {
      notification.onclick = () => {
        window.focus()
        onClick()
        notification.close()
      }
    }

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000)
  } catch {
    // Silently fail — notification not critical
  }
}

/**
 * Hook para usar no workspace. Escuta eventos SSE e mostra notificações.
 */
export function useBrowserNotifications(orgId: string) {
  const requestAndNotify = useCallback(async (title: string, body: string) => {
    const granted = await requestPermission()
    if (granted) {
      notifyBrowser(title, { body })
    }
  }, [])

  // Request permission on mount
  useEffect(() => {
    if (orgId) {
      requestPermission()
    }
  }, [orgId])

  return { notify: requestAndNotify, permissionGranted }
}

/**
 * Escuta eventos SSE e dispara notificações para eventos da daily.
 * Coloque no workspace page.
 */
export function useDailyNotifications(orgId: string) {
  const { notify } = useBrowserNotifications(orgId)

  useEffect(() => {
    if (!orgId) return

    const eventSource = new EventSource(`/api/events/stream?orgId=${orgId}`)

    let lastDailyStartingId: string | null = null
    let lastDailyCompletedId: string | null = null

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "initial" || data.type === "update") {
          const events = data.events || []

          for (const ev of events) {
            // Daily starting — notify once per daily
            if (ev.type === "daily_starting" && ev.id !== lastDailyStartingId) {
              lastDailyStartingId = ev.id
              notify(
                "📅 Daily iniciada",
                "Sua equipe está se reunindo para planejar o dia."
              )
            }

            // Daily completed — notify with summary preview
            if (ev.type === "daily_completed" && ev.id !== lastDailyCompletedId) {
              lastDailyCompletedId = ev.id
              notify(
                "✅ Daily concluída",
                ev.title || "Sua equipe planejou o dia."
              )
            }
          }
        }
      } catch {}
    }

    eventSource.onerror = () => {
      // SSE connection lost — will auto-reconnect
    }

    return () => {
      eventSource.close()
    }
  }, [orgId, notify])

  return null
}
