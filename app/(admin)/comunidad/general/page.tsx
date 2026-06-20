'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useEmpleadoActual } from '@/lib/useEmpleado'
import { Send, RefreshCw, MessageCircle } from 'lucide-react'
import type { MensajeChat } from '@/lib/supabase'

const AVATAR_COLORS = ['bg-rose-500','bg-blue-500','bg-emerald-500','bg-violet-500','bg-amber-500','bg-cyan-500']
function avatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] }
function fmtHora(s: string) {
  const d = new Date(s)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString()
    ? hora
    : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) + ' ' + hora
}

export default function PaginaChatAdmin() {
  const { empleado } = useEmpleadoActual()
  const [msgs, setMsgs] = useState<MensajeChat[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nombre = empleado?.nombre ?? 'Admin'

  useEffect(() => {
    cargar()
    const ch = supabase.channel('chat_general')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes_chat' },
        p => setMsgs(prev => [...prev, p.new as MensajeChat]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function cargar() {
    const { data } = await supabase
      .from('mensajes_chat')
      .select('id,local_id,empleado_nombre,mensaje,created_at')
      .order('created_at', { ascending: true })
      .limit(100)
    setMsgs(data ?? [])
    setLoading(false)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!texto.trim() || enviando) return
    setEnviando(true)
    await supabase.from('mensajes_chat').insert({
      local_id: empleado?.local_id ?? 1,
      empleado_nombre: nombre,
      mensaje: texto.trim(),
    })
    setTexto('')
    setEnviando(false)
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
        <MessageCircle size={20} className="text-[#F5B731]" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">Chat de equipo</h1>
          <p className="text-xs text-gray-400">Canal general del local · tiempo real</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-gray-50">
        {loading ? (
          <div className="flex justify-center pt-10">
            <RefreshCw className="animate-spin text-[#F5B731]" size={22} />
          </div>
        ) : msgs.length === 0 ? (
          <div className="text-center text-gray-400 pt-16">
            <MessageCircle size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">No hay mensajes aún. ¡Sé el primero en escribir!</p>
          </div>
        ) : (
          msgs.map(m => {
            const esPropio = m.empleado_nombre === nombre
            return (
              <div key={m.id} className={`flex items-end gap-2 ${esPropio ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full ${avatarColor(m.empleado_nombre)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {m.empleado_nombre.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-sm flex flex-col ${esPropio ? 'items-end' : 'items-start'}`}>
                  {!esPropio && <p className="text-xs text-gray-500 mb-1 ml-1">{m.empleado_nombre}</p>}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                    esPropio
                      ? 'bg-[#F5B731] text-[#1A1A1A] rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}>
                    {m.mensaje}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 mx-1">{fmtHora(m.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={enviar} className="px-6 py-4 bg-white border-t border-gray-200 flex gap-3 items-end flex-shrink-0">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e as unknown as React.FormEvent) }
          }}
          placeholder="Escribe un mensaje... (Enter para enviar)"
          rows={1}
          className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5B731] resize-none min-h-[42px] max-h-32"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="w-10 h-10 bg-[#F5B731] text-[#1A1A1A] rounded-xl hover:bg-[#e0a820] transition-colors disabled:opacity-40 flex items-center justify-center flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
