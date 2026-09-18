import { useMemo, useState } from 'react'
import { Clock3, History, Play, Search, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/audio'
import { usePlaygroundStore } from '@/store/playground-store'

function relativeTime(isoDate: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function HistoryPanel({ className }: { className?: string }) {
  const generations = usePlaygroundStore(state => state.generations)
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

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-muted-foreground" />
              History
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Recent generations in this browser.</p>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary">{generations.length}</Badge>
            {generations.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearHistory}
                aria-label="Clear generation history"
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
            placeholder="Search history"
            className="pl-8"
          />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {filtered.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <Clock3 className="mb-3 size-5 text-muted-foreground/50" />
              <p className="text-sm font-medium">{generations.length === 0 ? 'No generations yet' : 'No matches'}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {generations.length === 0
                  ? 'Generated audio will appear here. Files stay local to this browser session.'
                  : 'Try a model, voice, or text search.'}
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
                      removeGeneration(generation.id)
                    }}
                    aria-label="Remove generation"
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
                    <span className="text-[10px] text-muted-foreground">{relativeTime(generation.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-foreground/85">{generation.input}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{generation.voice || 'default voice'}</span>
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
