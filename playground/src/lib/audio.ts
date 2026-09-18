const WAVEFORM_SAMPLES = 180

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext
  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextConstructor) return null
  audioContext = new AudioContextConstructor()
  return audioContext
}

function extractWaveform(buffer: AudioBuffer): number[] {
  const channel = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(channel.length / WAVEFORM_SAMPLES))
  const waveform: number[] = []

  for (let index = 0; index < WAVEFORM_SAMPLES; index += 1) {
    const start = index * step
    const end = Math.min(start + step, channel.length)
    let peak = 0

    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, Math.abs(channel[cursor]))
    }

    waveform.push(Math.min(1, peak * 1.8))
  }

  return waveform
}

export async function decodeWaveform(
  blob: Blob,
): Promise<{ duration: number; waveform: number[] } | null> {
  const context = getAudioContext()
  if (!context) return null

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0))
    return {
      duration: decoded.duration,
      waveform: extractWaveform(decoded),
    }
  } catch {
    return null
  }
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function audioExtension(responseFormat: string): string {
  if (responseFormat === 'opus') return 'ogg'
  if (responseFormat === 'pcm') return 'pcm'
  return responseFormat
}

export function downloadAudio(audioUrl: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = audioUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
