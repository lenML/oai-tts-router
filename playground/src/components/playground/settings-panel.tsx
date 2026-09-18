import { useMemo } from 'react'
import { Check, ChevronDown, KeyRound, Loader2, RefreshCw, Server, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/store/playground-store'

const RESPONSE_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']

const CONNECTION_BADGE = {
  idle: { label: 'Idle', className: '' },
  loading: { label: 'Connecting', className: 'border-amber-500/30 text-amber-300' },
  online: { label: 'Connected', className: 'border-emerald-500/30 text-emerald-300' },
  auth: { label: 'API key required', className: 'border-amber-500/30 text-amber-300' },
  offline: { label: 'Offline', className: 'border-destructive/30 text-destructive' },
} as const

export function SettingsPanel({ className }: { className?: string }) {
  const baseUrl = usePlaygroundStore(state => state.baseUrl)
  const apiKey = usePlaygroundStore(state => state.apiKey)
  const connection = usePlaygroundStore(state => state.connection)
  const models = usePlaygroundStore(state => state.models)
  const modelsError = usePlaygroundStore(state => state.modelsError)
  const model = usePlaygroundStore(state => state.model)
  const voice = usePlaygroundStore(state => state.voice)
  const speed = usePlaygroundStore(state => state.speed)
  const responseFormat = usePlaygroundStore(state => state.responseFormat)
  const instructions = usePlaygroundStore(state => state.instructions)
  const extraJson = usePlaygroundStore(state => state.extraJson)

  const setBaseUrl = usePlaygroundStore(state => state.setBaseUrl)
  const setApiKey = usePlaygroundStore(state => state.setApiKey)
  const setModel = usePlaygroundStore(state => state.setModel)
  const setVoice = usePlaygroundStore(state => state.setVoice)
  const setSpeed = usePlaygroundStore(state => state.setSpeed)
  const setResponseFormat = usePlaygroundStore(state => state.setResponseFormat)
  const setInstructions = usePlaygroundStore(state => state.setInstructions)
  const setExtraJson = usePlaygroundStore(state => state.setExtraJson)
  const fetchModels = usePlaygroundStore(state => state.fetchModels)

  const selectedModel = models.find(item => item.id === model)
  const voices = selectedModel?.supported_voices ?? []
  const connectionBadge = CONNECTION_BADGE[connection]
  const extraJsonError = useMemo(() => {
    if (!extraJson.trim()) return ''
    try {
      const parsed: unknown = JSON.parse(extraJson)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Must be a JSON object'
      }
      return ''
    } catch {
      return 'Invalid JSON'
    }
  }, [extraJson])

  const refreshModels = async () => {
    try {
      await fetchModels()
      toast.success('Model list updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load models')
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            Connection
          </CardTitle>
          <CardDescription>Point the studio at any compatible router.</CardDescription>
          <CardAction>
            <Badge variant="outline" className={connectionBadge.className}>
              {connection === 'loading' && <Loader2 className="animate-spin" />}
              {connection === 'online' && <Check />}
              {connectionBadge.label}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={baseUrl}
              onChange={event => setBaseUrl(event.target.value)}
              onBlur={() => void refreshModels()}
              placeholder="http://localhost:4567/v1"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="api-key" className="flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-muted-foreground" />
              API key
            </Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              onBlur={() => void refreshModels()}
              placeholder="Optional Bearer token"
              autoComplete="off"
            />
          </div>
          <Button variant="outline" className="w-full" onClick={refreshModels} disabled={connection === 'loading'}>
            {connection === 'loading' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Refresh models
          </Button>
          {modelsError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs leading-relaxed text-destructive">
              {modelsError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            Synthesis
          </CardTitle>
          <CardDescription>Core OpenAI-compatible speech parameters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model" className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent position="popper">
                {models.map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="voice">Voice</Label>
            {voices.length > 0 ? (
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger id="voice" className="w-full">
                  <SelectValue placeholder="Select voice" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {voices.map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="voice"
                value={voice}
                onChange={event => setVoice(event.target.value)}
                placeholder="Provider default"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="format">Format</Label>
              <Select value={responseFormat} onValueChange={setResponseFormat}>
                <SelectTrigger id="format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {RESPONSE_FORMATS.map(format => (
                    <SelectItem key={format} value={format}>
                      {format.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Speed</Label>
              <div className="flex h-8 items-center gap-2 rounded-lg border bg-input/30 px-2.5">
                <Slider
                  value={[speed]}
                  min={0.25}
                  max={4}
                  step={0.05}
                  onValueChange={([nextSpeed]) => setSpeed(nextSpeed)}
                  aria-label="Speech speed"
                />
                <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                  {speed.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={event => setInstructions(event.target.value)}
              placeholder="Tone, pacing, emotion, style..."
              className="min-h-20 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      <Collapsible>
        <Card size="sm">
          <CollapsibleTrigger asChild>
            <button type="button" className="group flex w-full items-center justify-between px-3 text-left">
              <div>
                <div className="text-sm font-medium">Advanced params</div>
                <div className="mt-0.5 text-xs text-muted-foreground">Merge provider-specific JSON.</div>
              </div>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2 pt-3">
              <Textarea
                value={extraJson}
                onChange={event => setExtraJson(event.target.value)}
                placeholder={'{\n  "text_split": true,\n  "fallback_models": ["edge-tts"]\n}'}
                className="min-h-32 resize-y font-mono text-xs"
                spellCheck={false}
              />
              <p className={cn('text-xs', extraJsonError ? 'text-destructive' : 'text-muted-foreground')}>
                {extraJsonError || 'Merged last, so these values can override standard parameters.'}
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
