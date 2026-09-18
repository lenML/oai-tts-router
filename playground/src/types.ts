export interface ModelInfo {
  id: string
  object?: string
  created?: number
  owned_by?: string
  supported_voices?: string[]
}

export interface Generation {
  id: string
  model: string
  voice: string
  input: string
  responseFormat: string
  speed: number
  audioUrl: string
  waveform: number[] | null
  duration: number
  contentType: string
  requestBody: Record<string, unknown>
  createdAt: string
}

export interface SpeechResponse {
  blob: Blob
  contentType: string
}

export type ConnectionState = 'idle' | 'loading' | 'online' | 'auth' | 'offline'
