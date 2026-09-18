import { useState } from 'react'
import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Command, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LANGUAGE_OPTIONS, changeLanguage, type SupportedLanguage } from '@/i18n'

function currentLanguage(language: string): SupportedLanguage {
  if (language.startsWith('zh')) return 'zh'
  if (language.startsWith('ja')) return 'ja'
  if (language.startsWith('ko')) return 'ko'
  return 'en'
}

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const activeLanguage = currentLanguage(i18n.resolvedLanguage ?? i18n.language)
  const activeOption = LANGUAGE_OPTIONS.find(option => option.value === activeLanguage)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('language.label')}>
          <Languages />
          <span className="hidden md:inline">{activeOption?.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <Command>
          <CommandList>
            {LANGUAGE_OPTIONS.map(option => (
              <CommandItem
                key={option.value}
                value={option.value}
                data-checked={activeLanguage === option.value}
                onSelect={() => {
                  void changeLanguage(option.value)
                  setOpen(false)
                }}
              >
                <span>{option.label}</span>
                {activeLanguage === option.value && <Check className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
