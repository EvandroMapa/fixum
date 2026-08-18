"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function NovoImovelRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/painel?novo=1")
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      color: '#ffffff',
      fontSize: '0.9rem',
      fontWeight: 600
    }}>
      Abrindo formulário no painel...
    </div>
  )
}
