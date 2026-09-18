import type { ModelInfo, SpeechResponse } from '@/types'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function authHeaders(apiKey: string): HeadersInit {
  const key = apiKey.trim()
  return key ? { Authorization: `Bearer ${key}` } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function responseError(response: Response, fallback: string): Promise<ApiError> {
  try {
    const payload: unknown = await response.json()
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return new ApiError(payload.error.message, response.status)
    }
  } catch {
    // Fall through to the HTTP status when the body is not JSON.
  }
  return new ApiError(`${fallback} (${response.status} ${response.statusText})`, response.status)
}

export async function fetchModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ModelInfo[]> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
    headers: authHeaders(apiKey),
    signal,
  })

  if (!response.ok) {
    throw await responseError(response, 'Failed to load models')
  }

  const payload: unknown = await response.json()
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('The models endpoint returned an invalid response.')
  }

  return payload.data.filter(
    (model): model is ModelInfo =>
      isRecord(model) && typeof model.id === 'string' && model.id.length > 0,
  )
}

export async function createSpeech(
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<SpeechResponse> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(apiKey),
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    throw await responseError(response, 'Speech generation failed')
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error('The speech endpoint returned an empty audio response.')
  }

  return {
    blob,
    contentType: response.headers.get('content-type') ?? blob.type ?? 'audio/mpeg',
  }
}
