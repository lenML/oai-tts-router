import { AudioLines, BookOpen, Code2, History, PanelLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePlaygroundStore } from '@/store/playground-store'

interface PlaygroundHeaderProps {
  onOpenSettings: () => void
  onOpenHistory: () => void
}

const CONNECTION_LABEL = {
  idle: 'Not connected',
  loading: 'Connecting',
  online: 'Online',
  auth: 'API key required',
  offline: 'Offline',
} as const

const CONNECTION_CLASS = {
  idle: 'bg-muted-foreground/50',
  loading: 'bg-amber-400 animate-pulse',
  online: 'bg-emerald-400',
  auth: 'bg-amber-400',
  offline: 'bg-destructive',
} as const

export function PlaygroundHeader({ onOpenSettings, onOpenHistory }: PlaygroundHeaderProps) {
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
            <span className="truncate text-sm font-semibold tracking-tight">Speech Studio</span>
            <Badge variant="secondary" className="hidden rounded-full px-2 text-[10px] sm:inline-flex">
              oai-tts-router
            </Badge>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${CONNECTION_CLASS[connection]}`} />
            {CONNECTION_LABEL[connection]}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button asChild variant="ghost" size="icon-sm" className="hidden sm:inline-flex">
          <a
            href="https://github.com/lenML/oai-tts-router"
            target="_blank"
            rel="noreferrer"
            aria-label="Open GitHub repository"
          >
            <Code2 />
          </a>
        </Button>
        <Button asChild variant="ghost" size="icon-sm" className="hidden sm:inline-flex">
          <a
            href="https://github.com/lenML/oai-tts-router/blob/main/docs/api.md"
            target="_blank"
            rel="noreferrer"
            aria-label="Open API documentation"
          >
            <BookOpen />
          </a>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={onOpenSettings}>
              <PanelLeft />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Connection and synthesis settings</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="xl:hidden" onClick={onOpenHistory}>
              <History />
              <span className="hidden sm:inline">History</span>
              {generationCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 rounded-full px-1.5 text-[10px]">
                  {generationCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Recent generations</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
