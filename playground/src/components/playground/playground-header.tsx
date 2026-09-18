import { AudioLines, BookOpen, Code2, History, PanelLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/playground/language-switcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePlaygroundStore } from '@/store/playground-store'

interface PlaygroundHeaderProps {
  onOpenSettings: () => void
  onOpenHistory: () => void
}

const CONNECTION_CLASS = {
  idle: 'bg-muted-foreground/50',
  loading: 'bg-amber-400 animate-pulse',
  online: 'bg-emerald-400',
  auth: 'bg-amber-400',
  offline: 'bg-destructive',
} as const

export function PlaygroundHeader({ onOpenSettings, onOpenHistory }: PlaygroundHeaderProps) {
  const { t } = useTranslation()
  const connection = usePlaygroundStore(state => state.connection)
  const generationCount = usePlaygroundStore(state => state.generations.length)

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-xl lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
          <AudioLines className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold tracking-tight">{t('app.title')}</span>
            <Badge variant="secondary" className="hidden rounded-full px-2 text-[10px] sm:inline-flex">
              {t('app.badge')}
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${CONNECTION_CLASS[connection]}`} />
            {t(`connection.${connection}`)}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <LanguageSwitcher />
        <Button asChild variant="ghost" size="icon-sm" className="hidden sm:inline-flex">
          <a
            href="https://github.com/lenML/oai-tts-router"
            target="_blank"
            rel="noreferrer"
            aria-label={t('header.github')}
          >
            <Code2 />
          </a>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" className="hidden sm:inline-flex">
          <a
            href="https://github.com/lenML/oai-tts-router/blob/main/docs/api.md"
            target="_blank"
            rel="noreferrer"
            aria-label={t('header.docs')}
          >
            <BookOpen />
          </a>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenSettings}>
              <PanelLeft />
              <span className="hidden sm:inline">{t('header.settings')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('header.settingsTooltip')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="xl:hidden" onClick={onOpenHistory}>
              <History />
              <span className="hidden sm:inline">{t('header.history')}</span>
              {generationCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 rounded-full px-1.5 text-[10px]">
                  {generationCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('header.historyTooltip')}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
