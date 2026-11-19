import { create } from 'zustand'
import { LogEntry, LogCategory } from '../components/ActivityConsole'
import { SubtitleAction } from '../components/SubtitleModeSelector'

let logIdCounter = 0

export interface LogState {
  logs: LogEntry[]
  addLog: (text: string, category?: LogCategory) => void
  addSyncLog: (msg: string) => void
  addExtractLog: (msg: string) => void
  addTranslateLog: (msg: string) => void
  addGenerateLog: (msg: string) => void
  addBatchLog: (msg: string) => void
  addVideoLog: (msg: string, currentAction?: SubtitleAction) => void
  clearLogs: (category?: SubtitleAction | 'all') => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],

  addLog: (text: string, category: LogCategory = 'system') =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text, category }]
    })),

  addSyncLog: (msg: string) =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text: msg, category: 'sync' }]
    })),

  addExtractLog: (msg: string) =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text: msg, category: 'extract' }]
    })),

  addTranslateLog: (msg: string) =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text: msg, category: 'translate' }]
    })),

  addGenerateLog: (msg: string) =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text: msg, category: 'generate' }]
    })),

  addBatchLog: (msg: string) =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text: msg, category: 'batch' }]
    })),

  addVideoLog: (msg: string, currentAction: SubtitleAction = 'sync') =>
    set((state) => ({
      logs: [...state.logs, { id: ++logIdCounter, text: msg, category: currentAction }]
    })),

  clearLogs: (category?: SubtitleAction | 'all') =>
    set((state) => ({
      logs:
        !category || category === 'all'
          ? []
          : state.logs.filter((l) => l.category !== category)
    }))
}))
