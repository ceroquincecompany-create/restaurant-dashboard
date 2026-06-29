'use client'

import { useEffect } from 'react'

function AutoCierrePoller() {
  useEffect(() => {
    const poll = () => fetch('/api/auto-cierre-fichajes').catch(() => {})
    poll()
    const id = setInterval(poll, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return null
}

function EmailsPoller() {
  useEffect(() => {
    // Llama al procesar al cargar la app y luego cada 15 minutos
    // El cron de Vercel también lo llama cada 15 min en producción
    const poll = () => fetch('/api/procesar-emails-recibidos').catch(() => {})
    poll()
    const id = setInterval(poll, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoCierrePoller />
      <EmailsPoller />
      {children}
    </>
  )
}
