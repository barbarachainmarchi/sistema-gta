import { Header } from '@/components/layout/header'

export default function LogsPage() {
  return (
    <>
      <Header title="Logs" description="Histórico de alterações do sistema" />
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-muted-foreground text-sm">Em breve — próxima etapa</p>
      </div>
    </>
  )
}
