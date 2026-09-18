import { useMemo, useState } from 'react'
import { Clock3, History, Loader2, Play, Search, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/audio'
import { usePlaygroundStore } from '@/store/playground-store'

export function HistoryPanel({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const generations = usePlaygroundStore(state => state.generations)
  const historyLoading = usePlaygroundStore(state => state.historyLoading)
  const historyLimit = usePlaygroundStore(state => state.historyLimit)
  const activeGeneration = usePlaygroundStore(state => state.activeGeneration)
  const loadGeneration = usePlaygroundStore(state => state.loadGeneration)
  const removeGeneration = usePlaygroundStore(state => state.removeGeneration)
  const clearHistory = usePlaygroundStore(state => state.clearHistory)

  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return generations
    return generations.filter(
      generation =>
        generation.input.toLowerCase().includes(normalized) ||
        generation.model.toLowerCase().includes(normalized) ||
        generation.voice.toLowerCase().includes(normalized),
    )
  }, [generations, query])

  const formatCreatedAt = (isoDate: string): string =>
    new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoDate))

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-muted-foreground" />
              {t('history.title')}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('history.description')}</p>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary">
              {generations.length}/{historyLimit}
            </Badge>
            {generations.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void clearHistory()}
                aria-label={t('history.clear')}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('history.searchPlaceholder')}
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {historyLoading ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" />
              {t('history.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <Clock3 className="mb-3 size-5 text-muted-foreground/50" />
              <p className="text-sm font-medium">
                {generations.length === 0 ? t('history.emptyTitle') : t('history.noMatchTitle')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {generations.length === 0
                  ? t('history.emptyDescription')
                  : t('history.noMatchDescription')}
              </p>
            </div>
          ) : (
            filtered.map(generation => {
              const active = activeGeneration?.id === generation.id
              return (
                <div
                  key={generation.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'group relative cursor-pointer rounded-xl border bg-card p-3 pr-9 transition-colors hover:bg-muted/50',
                    active && 'border-foreground/30 bg-muted/60 ring-1 ring-foreground/10',
                  )}
                  onClick={() => loadGeneration(generation.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      loadGeneration(generation.id)
                    }
                  }}
                >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={event => {
                      event.stopPropagation()
                      void removeGeneration(generation.id)
                    }}
                    aria-label={t('history.remove')}
                  >
                    <X />
                  </Button>
                  <div className="mb-2 flex items-center gap-1.5">
                    {active && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
                        <Play className="size-2.5 fill-current" />
                      </span>
                    )}
                    <Badge variant="outline" className="max-w-32 truncate">
                      {generation.model}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{formatCreatedAt(generation.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-foreground/85">{generation.input}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{generation.voice || t('history.defaultVoice')}</span>
                    <span>·</span>
                    <span>{formatDuration(generation.duration)}</span>
                    <span>·</span>
                    <span className="uppercase">{generation.responseFormat}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
