"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logotipo } from "@/components/ui/Logo"
import FluxoEntrada from "@/components/auth/FluxoEntrada"
import styles from "../login/page.module.css"

/**
 * Esqueceu a senha: a pessoa entra com um código enviado ao e-mail e, já logada, define a nova senha.
 * Substitui o link de recuperação, que falhava quando aberto em outro aparelho/navegador.
 */
export default function RecuperarSenhaPage() {
  const router = useRouter()

  return (
    <div className={styles.pagina}>
      <div className={styles.lado}>
        <div className={styles.ladoConteudo}>
          <Link href="/" className={styles.logo}>
            <Logotipo largura={92} />
          </Link>

          <h1>Esqueceu a senha?</h1>
          <p style={{ marginBottom: '1.5rem' }}>
            Sem problema: receba um código no seu e-mail para entrar e, em seguida, crie uma senha nova — ou continue entrando só com o código.
          </p>

          <FluxoEntrada aoConcluir={() => router.push("/redefinir-senha")} destino="/redefinir-senha" />

          <div className={styles.rodape}>
            Lembrou sua senha?{" "}
            <Link href="/login">Fazer login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
