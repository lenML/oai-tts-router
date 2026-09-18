import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ApiError, createSpeech, fetchModels } from '@/lib/api'
import { decodeWaveform } from '@/lib/audio'
import type { ConnectionState, Generation, ModelInfo } from '@/types'

const DEFAULT_BASE_URL = `${window.location.origin}/v1`
const MAX_HISTORY = 30

const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'google-translate', owned_by: 'google', supported_voices: [] },
  {
    id: 'edge-tts',
    owned_by: 'microsoft',
    supported_voices: ['en-US-JennyNeural', 'en-US-AriaNeural', 'zh-CN-XiaoxiaoNeural'],
  },
  {
    id: 'openai-fm-tts',
    owned_by: 'openai-fm',
    supported_voices: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'],
  },
  {
    id: 'grok-console-tts',
    owned_by: 'x-ai',
    supported_voices: ['eve', 'ara', 'rex', 'sal', 'leo'],
  },
  {
    id: 'gemini-tts',
    owned_by: 'google',
    supported_voices: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Leda'],
  },
]

let activeController: AbortController | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function revokeGeneration(generation: Generation): void {
  URL.revokeObjectURL(generation.audioUrl)
}

function generationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

interface PlaygroundState {
  baseUrl: string
  apiKey: string
  volume: number
  muted: boolean
  autoplay: boolean

  connection: ConnectionState
  models: ModelInfo[]
  modelsError: string

  model: string
  voice: string
  speed: number
  responseFormat: string
  instructions: string
  extraJson: string
  input: string

  generations: Generation[]
  activeGeneration: Generation | null
  isGenerating: boolean
  isDecoding: boolean
  isPlaying: boolean
  currentTime: number
  playbackDuration: number
  playProgress: number

  setBaseUrl: (baseUrl: string) => void
  setApiKey: (apiKey: string) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setAutoplay: (autoplay: boolean) => void
  setModel: (model: string) => void
  setVoice: (voice: string) => void
  setSpeed: (speed: number) => void
  setResponseFormat: (responseFormat: string) => void
  setInstructions: (instructions: string) => void
  setExtraJson: (extraJson: string) => void
  setInput: (input: string) => void
  setPlaying: (playing: boolean) => void
  setPlaybackTime: (currentTime: number, duration?: number) => void
  setPlaybackDuration: (duration: number) => void

  fetchModels: () => Promise<void>
  submit: () => Promise<void>
  cancelGeneration: () => void
  clearResult: () => void
  loadGeneration: (id: string) => void
  removeGeneration: (id: string) => void
  clearHistory: () => void
}

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set, get) => ({
      baseUrl: DEFAULT_BASE_URL,
      apiKey: '',
      volume: 1,
      muted: false,
      autoplay: true,

      connection: 'idle',
      models: FALLBACK_MODELS,
      modelsError: '',

      model: 'google-translate',
      voice: '',
      speed: 1,
      responseFormat: 'mp3',
      instructions: '',
      extraJson: '',
      input: 'The quick brown fox jumps over the lazy dog.',

      generations: [],
      activeGeneration: null,
      isGenerating: false,
      isDecoding: false,
      isPlaying: false,
      currentTime: 0,
      playbackDuration: 0,
      playProgress: 0,

      setBaseUrl: baseUrl => set({ baseUrl, connection: 'idle', modelsError: '' }),
      setApiKey: apiKey => set({ apiKey, connection: 'idle', modelsError: '' }),
      setVolume: volume => set({ volume, muted: volume === 0 }),
      setMuted: muted => set({ muted }),
      setAutoplay: autoplay => set({ autoplay }),
      setModel: model => {
        const selected = get().models.find(item => item.id === model)
        const voice = selected?.supported_voices?.[0] ?? ''
        set({ model, voice })
      },
      setVoice: voice => set({ voice }),
      setSpeed: speed => set({ speed }),
      setResponseFormat: responseFormat => set({ responseFormat }),
      setInstructions: instructions => set({ instructions }),
      setExtraJson: extraJson => set({ extraJson }),
      setInput: input => set({ input }),
      setPlaying: isPlaying => set({ isPlaying }),
      setPlaybackTime: (currentTime, duration) =>
        set(state => {
          const resolvedDuration = duration ?? state.playbackDuration
          return {
            currentTime,
            playbackDuration: resolvedDuration,
            playProgress: resolvedDuration > 0 ? Math.min(1, currentTime / resolvedDuration) : 0,
          }
        }),
      setPlaybackDuration: playbackDuration => set({ playbackDuration }),

      fetchModels: async () => {
        const { baseUrl, apiKey } = get()
        set({ connection: 'loading', modelsError: '' })

        try {
          const models = await fetchModels(baseUrl, apiKey)
          const currentModel = get().model
          const selected = models.find(model => model.id === currentModel) ?? models[0]
          set({
            models: models.length > 0 ? models : FALLBACK_MODELS,
            connection: 'online',
            modelsError: '',
            model: selected?.id ?? currentModel,
            voice: selected?.supported_voices?.[0] ?? '',
          })
        } catch (error) {
          set({
            connection: error instanceof ApiError && error.status === 401 ? 'auth' : 'offline',
            modelsError: errorMessage(error),
          })
          throw error
        }
      },

      submit: async () => {
        const state = get()
        const trimmedInput = state.input.trim()
        if (!trimmedInput) {
          throw new Error('Enter text to synthesize.')
        }

        let extra: Record<string, unknown> = {}
        if (state.extraJson.trim()) {
          const parsed: unknown = JSON.parse(state.extraJson)
          if (!isRecord(parsed)) {
            throw new Error('Advanced params must be a JSON object.')
          }
          extra = parsed
        }

        const body: Record<string, unknown> = {
          model: state.model,
          input: trimmedInput,
          response_format: state.responseFormat,
          speed: state.speed,
          ...extra,
        }

        if (state.voice.trim()) body.voice = state.voice.trim()
        if (state.instructions.trim()) body.instructions = state.instructions.trim()

        activeController?.abort()
        const controller = new AbortController()
        activeController = controller
        set({ isGenerating: true, isDecoding: false, isPlaying: false })

        try {
          const response = await createSpeech(state.baseUrl, state.apiKey, body, controller.signal)
          const audioUrl = URL.createObjectURL(response.blob)
          set({ isGenerating: false, isDecoding: true })

          const decoded = await decodeWaveform(response.blob)
          const generation: Generation = {
            id: generationId(),
            model: state.model,
            voice: state.voice,
            input: trimmedInput,
            responseFormat: state.responseFormat,
            speed: state.speed,
            audioUrl,
            waveform: decoded?.waveform ?? null,
            duration: decoded?.duration ?? 0,
            contentType: response.contentType,
            requestBody: body,
            createdAt: new Date().toISOString(),
          }

          const generations = [generation, ...get().generations]
          const retained = generations.slice(0, MAX_HISTORY)
          generations.slice(MAX_HISTORY).forEach(revokeGeneration)

          set({
            generations: retained,
            activeGeneration: generation,
            currentTime: 0,
            playbackDuration: generation.duration,
            playProgress: 0,
            isPlaying: get().autoplay,
          })
        } finally {
          if (activeController === controller) {
            activeController = null
            set({ isGenerating: false, isDecoding: false })
          }
        }
      },

      cancelGeneration: () => {
        activeController?.abort()
        activeController = null
        set({ isGenerating: false, isDecoding: false })
      },

      clearResult: () =>
        set({
          activeGeneration: null,
          isPlaying: false,
          currentTime: 0,
          playbackDuration: 0,
          playProgress: 0,
        }),

      loadGeneration: id => {
        const generation = get().generations.find(item => item.id === id)
        if (!generation) return
        set({
          activeGeneration: generation,
          isPlaying: false,
          currentTime: 0,
          playbackDuration: generation.duration,
          playProgress: 0,
        })
      },

      removeGeneration: id => {
        const state = get()
        const generation = state.generations.find(item => item.id === id)
        if (!generation) return
        revokeGeneration(generation)
        const activeGeneration = state.activeGeneration?.id === id ? null : state.activeGeneration
        set({
          generations: state.generations.filter(item => item.id !== id),
          activeGeneration,
          isPlaying: activeGeneration ? state.isPlaying : false,
          currentTime: activeGeneration ? state.currentTime : 0,
          playbackDuration: activeGeneration ? state.playbackDuration : 0,
          playProgress: activeGeneration ? state.playProgress : 0,
        })
      },

      clearHistory: () => {
        get().generations.forEach(revokeGeneration)
        set({
          generations: [],
          activeGeneration: null,
          isPlaying: false,
          currentTime: 0,
          playbackDuration: 0,
          playProgress: 0,
        })
      },
    }),
    {
      name: 'oai-tts-router-playground',
      partialize: state => ({
        baseUrl: state.baseUrl,
        apiKey: state.apiKey,
        volume: state.volume,
        autoplay: state.autoplay,
        model: state.model,
        voice: state.voice,
        speed: state.speed,
        responseFormat: state.responseFormat,
        instructions: state.instructions,
        extraJson: state.extraJson,
        input: state.input,
      }),
    },
  ),
)
