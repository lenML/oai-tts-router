import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearHistoryRecords,
  deleteHistoryRecord,
  loadHistoryRecords,
  saveHistoryRecord,
} from '@/lib/history-db'
import type { Generation } from '@/types'

function makeGeneration(id: string, createdAt: string): Generation {
  return {
    id,
    model: 'test-model',
    voice: 'test-voice',
    input: `input-${id}`,
    responseFormat: 'mp3',
    speed: 1,
    audioUrl: `blob:${id}`,
    blob: new Blob([id], { type: 'audio/mpeg' }),
    waveform: [0.1, 0.2],
    duration: 1,
    contentType: 'audio/mpeg',
    requestBody: { model: 'test-model', input: `input-${id}` },
    createdAt,
  }
}

describe('history-db', () => {
  beforeEach(async () => {
    await clearHistoryRecords()
  })

  it('stores records and returns newest first', async () => {
    await saveHistoryRecord(makeGeneration('older', '2026-01-01T00:00:00.000Z'), 30)
    await saveHistoryRecord(makeGeneration('newer', '2026-01-02T00:00:00.000Z'), 30)

    const records = await loadHistoryRecords(30)
    expect(records.map(record => record.id)).toEqual(['newer', 'older'])
  })

  it('prunes records beyond the configured limit', async () => {
    await saveHistoryRecord(makeGeneration('one', '2026-01-01T00:00:00.000Z'), 2)
    await saveHistoryRecord(makeGeneration('two', '2026-01-02T00:00:00.000Z'), 2)
    const deleted = await saveHistoryRecord(makeGeneration('three', '2026-01-03T00:00:00.000Z'), 2)

    expect(deleted).toEqual(['one'])
    const records = await loadHistoryRecords(2)
    expect(records.map(record => record.id)).toEqual(['three', 'two'])
  })

  it('deletes one record without clearing the rest', async () => {
    await saveHistoryRecord(makeGeneration('one', '2026-01-01T00:00:00.000Z'), 30)
    await saveHistoryRecord(makeGeneration('two', '2026-01-02T00:00:00.000Z'), 30)

    await deleteHistoryRecord('two')
    const records = await loadHistoryRecords(30)
    expect(records.map(record => record.id)).toEqual(['one'])
  })
})
