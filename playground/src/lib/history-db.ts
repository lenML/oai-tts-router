import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Generation, PersistedGeneration } from '@/types'

const DATABASE_NAME = 'oai-tts-router-playground'
const DATABASE_VERSION = 1
const HISTORY_STORE = 'generations'

interface PlaygroundDatabase extends DBSchema {
  generations: {
    key: string
    value: PersistedGeneration
    indexes: { 'by-created-at': string }
  }
}

let databasePromise: Promise<IDBPDatabase<PlaygroundDatabase>> | undefined

function getDatabase(): Promise<IDBPDatabase<PlaygroundDatabase>> {
  databasePromise ??= openDB<PlaygroundDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore(HISTORY_STORE, { keyPath: 'id' })
      store.createIndex('by-created-at', 'createdAt')
    },
  })
  return databasePromise
}

function toPersistedGeneration(generation: Generation): PersistedGeneration {
  return {
    id: generation.id,
    model: generation.model,
    voice: generation.voice,
    input: generation.input,
    responseFormat: generation.responseFormat,
    speed: generation.speed,
    blob: generation.blob,
    waveform: generation.waveform,
    duration: generation.duration,
    contentType: generation.contentType,
    requestBody: generation.requestBody,
    createdAt: generation.createdAt,
  }
}

export function toGeneration(persisted: PersistedGeneration): Generation {
  return {
    ...persisted,
    audioUrl: URL.createObjectURL(persisted.blob),
  }
}

export async function saveHistoryRecord(generation: Generation, limit: number): Promise<string[]> {
  const database = await getDatabase()
  const transaction = database.transaction(HISTORY_STORE, 'readwrite')
  const store = transaction.objectStore(HISTORY_STORE)

  await store.put(toPersistedGeneration(generation))

  const records = await store.index('by-created-at').getAll()
  const excess = records.slice(0, Math.max(0, records.length - limit))
  for (const record of excess) {
    await store.delete(record.id)
  }

  await transaction.done
  return excess.map(record => record.id)
}

export async function loadHistoryRecords(limit: number): Promise<PersistedGeneration[]> {
  const database = await getDatabase()
  const transaction = database.transaction(HISTORY_STORE, 'readwrite')
  const store = transaction.objectStore(HISTORY_STORE)

  const records = await store.index('by-created-at').getAll()
  const excess = records.slice(0, Math.max(0, records.length - limit))
  for (const record of excess) {
    await store.delete(record.id)
  }

  await transaction.done
  return records.slice(-limit).reverse()
}

export async function deleteHistoryRecord(id: string): Promise<void> {
  const database = await getDatabase()
  await database.delete(HISTORY_STORE, id)
}

export async function clearHistoryRecords(): Promise<void> {
  const database = await getDatabase()
  await database.clear(HISTORY_STORE)
}
