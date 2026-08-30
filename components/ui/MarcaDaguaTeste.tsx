import styles from './MarcaDaguaTeste.module.css'

interface Props {
  variante?: 'padrao' | 'grande' | 'compacto' | 'lightbox'
}

export default function MarcaDaguaTeste({ variante = 'padrao' }: Props) {
  return (
    <div className={`${styles.container} ${styles[variante]}`}>
      <div className={styles.seloDiscreto}>
        <span className={styles.icone}>⚠️</span>
        <span className={styles.texto}>Anúncio Fictício • Ambiente de Testes</span>
      </div>
    </div>
  )
}
