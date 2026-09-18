import { useEffect, useRef } from 'react'
import {
  ChevronDown,
  Clipboard,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Waveform } from '@/components/playground/waveform'
import { audioExtension, downloadAudio, formatDuration } from '@/lib/audio'
import { usePlaygroundStore } from '@/store/playground-store'

function ResultPlaceholder() {
  const { t } = useTranslation()
  const isLoading = usePlaygroundStore(state => state.isGenerating || state.isDecoding)

  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-20 items-end gap-1.5">
        {[18, 38, 62, 30, 76, 48, 88, 55, 34, 68, 42, 24].map((height, index) => (
          <span
            key={`${height}-${index}`}
            className="w-1.5 rounded-full bg-muted-foreground/20"
            style={{ height }}
          />
        ))}
      </div>
      {isLoading ? (
        <>
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('result.synthesizing')}</p>
        </>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">{t('result.emptyTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('result.emptyDescription')}</p>
          </div>
          <Badge variant="secondary">
            <Sparkles />
            {t('result.ready')}
          </Badge>
        </>
      )}
    </div>
  )
}

export function ResultCard() {
  const { t } = useTranslation()
  const generation = usePlaygroundStore(state => state.activeGeneration)
  const currentTime = usePlaygroundStore(state => state.currentTime)
  const duration = usePlaygroundStore(state => state.playbackDuration)
  const playProgress = usePlaygroundStore(state => state.playProgress)
  const isPlaying = usePlaygroundStore(state => state.isPlaying)
  const isGenerating = usePlaygroundStore(state => state.isGenerating)
  const isDecoding = usePlaygroundStore(state => state.isDecoding)
  const volume = usePlaygroundStore(state => state.volume)
  const muted = usePlaygroundStore(state => state.muted)
  const autoplay = usePlaygroundStore(state => state.autoplay)
  const setPlaying = usePlaygroundStore(state => state.setPlaying)
  const setPlaybackTime = usePlaygroundStore(state => state.setPlaybackTime)
  const setPlaybackDuration = usePlaygroundStore(state => state.setPlaybackDuration)
  const setVolume = usePlaygroundStore(state => state.setVolume)
  const setMuted = usePlaygroundStore(state => state.setMuted)
  const setAutoplay = usePlaygroundStore(state => state.setAutoplay)
  const clearResult = usePlaygroundStore(state => state.clearResult)

  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!generation) {
      audio.removeAttribute('src')
      audio.load()
      return
    }

    audio.src = generation.audioUrl
    audio.load()
    setPlaybackDuration(generation.duration)
    setPlaybackTime(0, generation.duration)
  }, [generation, setPlaybackDuration, setPlaybackTime])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !generation) return

    if (isPlaying) {
      void audio.play().catch(error => {
        setPlaying(false)
        if (error instanceof Error && error.name !== 'AbortError') {
          toast.error(t('result.playbackFailed'))
        }
      })
    } else {
      audio.pause()
    }
  }, [generation, isPlaying, setPlaying, t])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted
  }, [muted, volume])

  const seek = (progress: number) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const nextTime = progress * duration
    audio.currentTime = nextTime
    setPlaybackTime(nextTime, duration)
  }

  const skip = (seconds: number) => {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const nextTime = Math.max(0, Math.min(duration, audio.currentTime + seconds))
    audio.currentTime = nextTime
    setPlaybackTime(nextTime, duration)
  }

  const copyRequest = async () => {
    if (!generation) return
    await navigator.clipboard.writeText(JSON.stringify(generation.requestBody, null, 2))
    toast.success(t('result.copied'))
  }

  const download = () => {
    if (!generation) return
    downloadAudio(
      generation.audioUrl,
      `tts-${generation.model}-${Date.now()}.${audioExtension(generation.responseFormat)}`,
    )
  }

  const waveform = generation?.waveform ?? Array.from({ length: 180 }, () => 0.08)

  return (
    <Card className="relative shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>{t('result.title')}</CardTitle>
        <CardAction className="flex items-center gap-2">
          {(isGenerating || isDecoding) && (
            <Badge variant="outline">
              <Loader2 className="animate-spin" />
              {isDecoding ? t('result.decoding') : t('result.generating')}
            </Badge>
          )}
          {generation && <Badge variant="secondary">{generation.responseFormat.toUpperCase()}</Badge>}
        </CardAction>
      </CardHeader>

      <CardContent className="p-5">
        {!generation ? (
          <ResultPlaceholder />
        ) : (
          <div className="space-y-4">
            <audio
              ref={audioRef}
              onTimeUpdate={event => setPlaybackTime(event.currentTarget.currentTime)}
              onLoadedMetadata={event => {
                const nextDuration = event.currentTarget.duration
                if (Number.isFinite(nextDuration) && nextDuration > 0) {
                  setPlaybackDuration(nextDuration)
                  setPlaybackTime(event.currentTarget.currentTime, nextDuration)
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                setPlaying(false)
                setPlaybackTime(duration, duration)
              }}
              onError={() => setPlaying(false)}
            />

            <Waveform values={waveform} progress={playProgress} onSeek={seek} />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Button
                  size="icon-lg"
                  className="rounded-full"
                  onClick={() => setPlaying(!isPlaying)}
                  aria-label={isPlaying ? t('result.pause') : t('result.play')}
                >
                  {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => skip(-5)} aria-label={t('result.rewind')}>
                  <RotateCcw />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => skip(5)} aria-label={t('result.skip')}>
                  <RotateCw />
                </Button>
                <span className="ml-1 font-mono text-xs text-muted-foreground">
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </span>
              </div>

              <div className="flex flex-1 items-center gap-2 sm:justify-end">
                <Button variant="ghost" size="icon-sm" onClick={() => setMuted(!muted)} aria-label={t('result.mute')}>
                  {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
                </Button>
                <Slider
                  value={[muted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-24"
                  onValueChange={([nextVolume]) => {
                    setVolume(nextVolume)
                    if (nextVolume > 0) setMuted(false)
                  }}
                  aria-label={t('result.mute')}
                />
                <Separator orientation="vertical" className="mx-1 h-5" />
                <Button variant="outline" size="sm" onClick={download}>
                  <Download />
                  {t('result.download')}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={clearResult} aria-label={t('result.clear')}>
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{generation.model}</Badge>
              {generation.voice && <Badge variant="outline">{generation.voice}</Badge>}
              <Badge variant="outline">{generation.speed.toFixed(2)}x</Badge>
              <span className="truncate">{generation.contentType}</span>
            </div>
          </div>
        )}
      </CardContent>

      {generation && (
        <CardFooter className="justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={autoplay} onCheckedChange={setAutoplay} size="sm" id="autoplay" />
            <label htmlFor="autoplay">{t('result.autoplay')}</label>
          </div>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="xs">
                <Clipboard />
                {t('result.request')}
                <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute right-5 bottom-16 z-20 w-80 max-w-[calc(100vw-2.5rem)]">
              <div className="rounded-xl border bg-popover p-3 shadow-xl">
                <pre className="max-h-72 overflow-auto text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(generation.requestBody, null, 2)}
                </pre>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => void copyRequest()}>
                  <Clipboard />
                  {t('result.copyJson')}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardFooter>
      )}
    </Card>
  )
}
