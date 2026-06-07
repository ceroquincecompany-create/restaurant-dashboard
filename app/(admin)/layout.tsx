import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ADMIN_IP = '188.76.183.5'

async function getClientIP(): Promise<string | null> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return null
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const rol = cookieStore.get('user_rol')?.value

  // Only enforce IP restriction for admin role.
  // Employees (rol = 'empleado') never go through this layout.
  if (rol === 'admin') {
    const clientIP = await getClientIP()
    // clientIP is null when there is no proxy header (local dev) — skip restriction.
    if (clientIP !== null && clientIP !== ADMIN_IP) {
      redirect('/login?error=ip_restringida')
    }
  }

  return <>{children}</>
}
