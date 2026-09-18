import { useMemo } from 'react'
import { Command, Sparkles, Square, WandSparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/store/playground-store'

const QUICK_PROMPTS = [
  { label: 'Narration', text: 'In a quiet studio, a voice begins to tell a story that has never been heard before.' },
  { label: 'Assistant', text: 'Your request is ready. I have organized the key details and prepared the next steps.' },
  { label: 'Chinese', text: '欢迎使用语音合成工作台。输入文本，选择模型，然后生成自然流畅的语音。' },
]

export function ComposerCard() {
  const input = usePlaygroundStore(state => state.input)
  const model = usePlaygroundStore(state => state.model)
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
      toast.success('Speech generated')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info('Generation cancelled')
        return
      }
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void generate()
    }
  }

  return (
    <Card className="overflow-visible shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>Compose</CardTitle>
        <CardAction className="flex items-center gap-2">
          <Badge variant="outline">{model}</Badge>
          {remaining < 0 && <Badge variant="destructive">Over limit</Badge>}
        </CardAction>
      </CardHeader>

      <CardContent className="p-0">
        <Textarea
          value={input}
          onChange={event => setInput(event.target.value.slice(0, inputLimit))}
          onKeyDown={handleKeyDown}
          placeholder="Write something worth listening to..."
          className="min-h-52 resize-none rounded-none border-0 bg-transparent px-5 py-5 text-base leading-7 shadow-none focus-visible:ring-0 md:min-h-64"
          maxLength={inputLimit}
        />
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {QUICK_PROMPTS.map(prompt => (
            <Button
              key={prompt.label}
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setInput(prompt.text)}
            >
              <WandSparkles />
              {prompt.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className={cn('font-mono text-[11px]', remaining < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {input.length.toLocaleString()} / {inputLimit.toLocaleString()}
          </span>
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground md:flex">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans">
              <Command className="inline size-2.5" /> Enter
            </kbd>
          </span>
          {busy ? (
            <Button variant="outline" onClick={cancelGeneration}>
              <Square className="fill-current" />
              Stop
            </Button>
          ) : (
            <Button onClick={() => void generate()} disabled={!input.trim()}>
              <Sparkles />
              Generate
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
