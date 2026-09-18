import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ComposerCard } from '@/components/playground/composer-card'
import { HistoryPanel } from '@/components/playground/history-panel'
import { PlaygroundHeader } from '@/components/playground/playground-header'
import { ResultCard } from '@/components/playground/result-card'
import { SettingsPanel } from '@/components/playground/settings-panel'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api'
import { usePlaygroundStore } from '@/store/playground-store'

export default function App() {
  const { t, i18n } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const fetchModels = usePlaygroundStore(state => state.fetchModels)
  const loadHistory = usePlaygroundStore(state => state.loadHistory)
  const didFetchModels = useRef(false)
  const didLoadHistory = useRef(false)

  useEffect(() => {
    document.title = `${t('app.title')} | ${t('app.badge')}`
  }, [i18n.resolvedLanguage, t])

  useEffect(() => {
    if (didFetchModels.current) return
    didFetchModels.current = true
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = async () => {
      try {
        await fetchModels()
      } catch (error) {
        if (cancelled || (error instanceof ApiError && error.status === 401)) return
        retryTimer = setTimeout(() => void connect(), 2000)
      }
    }

    void connect()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [fetchModels])

  useEffect(() => {
    if (didLoadHistory.current) return
    didLoadHistory.current = true
    void loadHistory()
  }, [loadHistory])

  return (
    <TooltipProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <PlaygroundHeader
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px]">
          <aside className="hidden min-h-0 overflow-y-auto border-r bg-muted/10 p-3 lg:block">
            <SettingsPanel />
          </aside>

          <main className="relative min-h-0 overflow-y-auto">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.04]" />
            <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-5 sm:px-6 sm:py-7">
              <div>
                <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  {t('app.kicker')}
                </p>
                <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t('app.title')}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t('app.description')}
                </p>
              </div>

              <ResultCard />
              <ComposerCard />
            </div>
          </main>

          <aside className="hidden min-h-0 border-l xl:block">
            <HistoryPanel />
          </aside>
        </div>

        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent side="left" className="w-[min(92vw,380px)] gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>{t('sheet.settingsTitle')}</SheetTitle>
              <SheetDescription>{t('sheet.settingsDescription')}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <SettingsPanel />
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="right" className="w-[min(92vw,380px)] gap-0 p-0 sm:max-w-sm">
            <SheetHeader className="border-b pr-12">
              <SheetTitle>{t('sheet.historyTitle')}</SheetTitle>
              <SheetDescription>{t('sheet.historyDescription')}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1">
              <HistoryPanel />
            </div>
          </SheetContent>
        </Sheet>

        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </TooltipProvider>
  )
}
