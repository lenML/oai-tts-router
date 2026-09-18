import { useState } from 'react'
import {
  AudioLines,
  Bot,
  Check,
  ChevronDown,
  FileAudio,
  Gauge,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { usePlaygroundStore } from '@/store/playground-store'

const RESPONSE_FORMATS = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm']
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]

interface SelectOption {
  value: string
  label: string
}

interface SelectPopoverProps {
  icon: LucideIcon
  label: string
  value: string
  options: SelectOption[]
  searchPlaceholder?: string
  emptyLabel: string
  onSelect: (value: string) => void
}

function SelectPopover({
  icon: Icon,
  label,
  value,
  options,
  searchPlaceholder,
  emptyLabel,
  onSelect,
}: SelectPopoverProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-48 rounded-full border border-transparent px-2.5 hover:border-border">
          <Icon className="text-muted-foreground" />
          <span className="hidden text-muted-foreground sm:inline">{label}</span>
          <span className="truncate font-medium">{value}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <Command>
          {searchPlaceholder && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map(option => (
              <CommandItem
                key={option.value}
                value={option.value}
                data-checked={option.value === value}
                onSelect={() => {
                  onSelect(option.value)
                  setOpen(false)
                }}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function PromptControls() {
  const { t } = useTranslation()
  const models = usePlaygroundStore(state => state.models)
  const model = usePlaygroundStore(state => state.model)
  const voice = usePlaygroundStore(state => state.voice)
  const responseFormat = usePlaygroundStore(state => state.responseFormat)
  const speed = usePlaygroundStore(state => state.speed)
  const instructions = usePlaygroundStore(state => state.instructions)
  const setModel = usePlaygroundStore(state => state.setModel)
  const setVoice = usePlaygroundStore(state => state.setVoice)
  const setResponseFormat = usePlaygroundStore(state => state.setResponseFormat)
  const setSpeed = usePlaygroundStore(state => state.setSpeed)
  const setInstructions = usePlaygroundStore(state => state.setInstructions)

  const selectedModel = models.find(item => item.id === model)
  const voices = selectedModel?.supported_voices ?? []

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <SelectPopover
        icon={Bot}
        label={t('composer.model')}
        value={model}
        options={models.map(item => ({ value: item.id, label: item.id }))}
        searchPlaceholder={t('composer.searchModel')}
        emptyLabel={t('composer.noResult')}
        onSelect={setModel}
      />

      {voices.length > 0 && (
        <SelectPopover
          icon={AudioLines}
          label={t('composer.voice')}
          value={voice || t('composer.defaultVoice')}
          options={voices.map(item => ({ value: item, label: item }))}
          searchPlaceholder={t('composer.searchVoice')}
          emptyLabel={t('composer.noResult')}
          onSelect={setVoice}
        />
      )}

      <SelectPopover
        icon={FileAudio}
        label={t('composer.format')}
        value={responseFormat.toUpperCase()}
        options={RESPONSE_FORMATS.map(item => ({ value: item, label: item.toUpperCase() }))}
        emptyLabel={t('composer.noResult')}
        onSelect={setResponseFormat}
      />

      <SelectPopover
        icon={Gauge}
        label={t('composer.speed')}
        value={`${speed.toFixed(2)}x`}
        options={SPEED_OPTIONS.map(item => ({ value: String(item), label: `${item}x` }))}
        emptyLabel={t('composer.noResult')}
        onSelect={value => setSpeed(Number(value))}
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="max-w-44 rounded-full border border-transparent px-2.5 hover:border-border">
            <SlidersHorizontal className="text-muted-foreground" />
            <span className="hidden text-muted-foreground sm:inline">{t('composer.instructions')}</span>
            <span className={cn('truncate font-medium', !instructions && 'text-muted-foreground')}>
              {instructions || t('composer.instructions')}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <Textarea
            value={instructions}
            onChange={event => setInstructions(event.target.value)}
            placeholder={t('composer.instructionsPlaceholder')}
            className="min-h-28 resize-none"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
