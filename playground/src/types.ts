export interface ModelInfo {
  id: string
  object?: string
  created?: number
  owned_by?: string
  supported_voices?: string[]
}

export interface PersistedGeneration {
  id: string
  model: string
  voice: string
  input: string
  responseFormat: string
  speed: number
  blob: Blob
  waveform: number[] | null
  duration: number
  contentType: string
  requestBody: Record<string, unknown>
  createdAt: string
}

export interface Generation extends PersistedGeneration {
  audioUrl: string
}

export interface SpeechResponse {
  blob: Blob
  contentType: string
}

export type ConnectionState = 'idle' | 'loading' | 'online' | 'auth' | 'offline'
