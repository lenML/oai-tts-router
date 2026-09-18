import { useMemo, useState } from 'react'
import { Check, ChevronDown, Database, KeyRound, Loader2, RefreshCw, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/store/playground-store'

const CONNECTION_BADGE_CLASS = {
  idle: '',
  loading: 'border-amber-500/30 text-amber-300',
  online: 'border-emerald-500/30 text-emerald-300',
  auth: 'border-amber-500/30 text-amber-300',
  offline: 'border-destructive/30 text-destructive',
} as const

export function SettingsPanel({ className }: { className?: string }) {
  const { t } = useTranslation()
  const baseUrl = usePlaygroundStore(state => state.baseUrl)
  const apiKey = usePlaygroundStore(state => state.apiKey)
  const connection = usePlaygroundStore(state => state.connection)
  const modelsError = usePlaygroundStore(state => state.modelsError)
  const extraJson = usePlaygroundStore(state => state.extraJson)
  const historyLimit = usePlaygroundStore(state => state.historyLimit)
  const [historyLimitDraft, setHistoryLimitDraft] = useState(String(historyLimit))

  const setBaseUrl = usePlaygroundStore(state => state.setBaseUrl)
  const setApiKey = usePlaygroundStore(state => state.setApiKey)
  const setExtraJson = usePlaygroundStore(state => state.setExtraJson)
  const setHistoryLimit = usePlaygroundStore(state => state.setHistoryLimit)
  const fetchModels = usePlaygroundStore(state => state.fetchModels)

  const normalizedBaseUrl = baseUrl.trim()

  const extraJsonError = useMemo(() => {
    if (!extraJson.trim()) return ''
    try {
      const parsed: unknown = JSON.parse(extraJson)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return t('settings.invalidJsonObject')
      }
      return ''
    } catch {
      return t('settings.invalidJson')
    }
  }, [extraJson, t])

  const refreshModels = async () => {
    if (!normalizedBaseUrl) return

    try {
      await fetchModels()
      toast.success(t('toast.modelsUpdated'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toast.modelsFailed'))
    }
  }

  const commitHistoryLimit = () => {
    const parsed = Number(historyLimitDraft)
    const normalized = Number.isFinite(parsed) ? Math.max(1, Math.min(200, Math.round(parsed))) : 30
    setHistoryLimitDraft(String(normalized))
    void setHistoryLimit(normalized)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-4 text-muted-foreground" />
            {t('settings.connectionTitle')}
          </CardTitle>
          <CardDescription>{t('settings.connectionDescription')}</CardDescription>
          <CardAction>
            <Badge variant="outline" className={CONNECTION_BADGE_CLASS[connection]}>
              {connection === 'loading' && <Loader2 className="animate-spin" />}
              {connection === 'online' && <Check />}
              {t(`connection.${connection}`)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="base-url">{t('settings.baseUrl')}</Label>
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
              {t('settings.apiKey')}
            </Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={event => setApiKey(event.target.value)}
              onBlur={() => void refreshModels()}
              placeholder={t('settings.apiKeyPlaceholder')}
              autoComplete="off"
            />
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={refreshModels}
            disabled={!normalizedBaseUrl || connection === 'loading'}
          >
            {connection === 'loading' ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t('settings.refresh')}
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
            <Database className="size-4 text-muted-foreground" />
            {t('settings.historyTitle')}
          </CardTitle>
          <CardDescription>{t('settings.historyDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label htmlFor="history-limit">{t('settings.historyLimit')}</Label>
          <Input
            id="history-limit"
            type="number"
            min={1}
            max={200}
            value={historyLimitDraft}
            onChange={event => setHistoryLimitDraft(event.target.value)}
            onBlur={commitHistoryLimit}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <p className="text-xs text-muted-foreground">{t('settings.historyLimitHint')}</p>
        </CardContent>
      </Card>

      <Collapsible>
        <Card size="sm">
          <CollapsibleTrigger asChild>
            <button type="button" className="group flex w-full items-center justify-between px-3 text-left">
              <div>
                <div className="text-sm font-medium">{t('settings.advancedTitle')}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t('settings.advancedDescription')}</div>
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
                {extraJsonError || t('settings.advancedHint')}
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
