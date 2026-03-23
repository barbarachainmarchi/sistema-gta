import { Header } from '@/components/layout/header'
import { BackupClient } from './backup-client'

export default function BackupPage() {
  return (
    <>
      <Header title="Backup" description="Exportar e importar dados do sistema" />
      <BackupClient />
    </>
  )
}
