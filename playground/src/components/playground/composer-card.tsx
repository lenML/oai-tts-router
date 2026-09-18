import { useMemo } from 'react'
import { ArrowUp, Command, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { PromptControls } from '@/components/playground/prompt-controls'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/store/playground-store'

export function ComposerCard() {
  const { t } = useTranslation()
  const input = usePlaygroundStore(state => state.input)
  const extraJson = usePlaygroundStore(state => state.extraJson)
  const isGenerating = usePlaygroundStore(state => state.isGenerating)
  const isDecoding = usePlaygroundStore(state => state.isDecoding)
  const setInput = usePlaygroundStore(state => state.setInput)
  const submit = usePlaygroundStore(state => state.submit)
  const cancelGeneration = usePlaygroundStore(state => state.cancelGeneration)

  const inputLimit = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(extraJson)
      if (typeof parsed === 'object' && parsed !== null && 'text_split' in parsed) {
        return (parsed as { text_split?: unknown }).text_split === true ? 100_000 : 4096
      }
    } catch {
      // The submit action reports malformed JSON with a toast.
    }
    return 4096
  }, [extraJson])

  const remaining = inputLimit - input.length
  const busy = isGenerating || isDecoding

  const generate = async () => {
    if (!input.trim() || busy) return
    try {
      await submit()
      toast.success(t('composer.generated'))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info(t('composer.cancelled'))
        return
      }
      const message = error instanceof Error ? error.message : t('composer.failed')
      toast.error(`${t('composer.failed')}: ${message}`)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void generate()
    }
  }

  return (
    <Card className="gap-0 overflow-visible rounded-3xl py-0 shadow-sm">
      <CardContent className="p-0">
        <Textarea
          value={input}
          onChange={event => setInput(event.target.value.slice(0, inputLimit))}
          onKeyDown={handleKeyDown}
          placeholder={t('composer.placeholder')}
          className="min-h-44 resize-none rounded-3xl border-0 bg-transparent px-5 py-5 text-base leading-7 shadow-none focus-visible:ring-0 md:min-h-52"
          maxLength={inputLimit}
          aria-label={t('composer.placeholder')}
        />
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 rounded-b-3xl border-t-0 bg-transparent px-3 py-3 sm:flex-row sm:items-center">
        <PromptControls />

        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          {remaining < 0 && <Badge variant="destructive">{t('composer.overLimit')}</Badge>}
          <span className={cn('font-mono text-[11px]', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {input.length.toLocaleString()} / {inputLimit.toLocaleString()}
          </span>
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans">
              <Command className="inline size-2.5" /> {t('composer.enterHint')}
            </kbd>
          </span>
          {busy ? (
            <Button variant="outline" size="icon-lg" className="rounded-full" onClick={cancelGeneration} aria-label={t('composer.stop')}>
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-lg"
              className="rounded-full"
              onClick={() => void generate()}
              disabled={!input.trim()}
              aria-label={t('composer.generate')}
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
