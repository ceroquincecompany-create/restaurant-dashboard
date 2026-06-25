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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AutoCierrePoller />
      {children}
    </>
  )
}
