/**
 * 多后端配置管理
 * 允许配置多个不同的 API 后端（各自的 API Key / Base URL / 模型），并选择其中一个作为当前使用。
 *
 * 持久化：优先通过主进程写入 userData/config.json（API Key 经 safeStorage 加密），
 * 并借助主进程广播实现跨窗口即时同步；在非 Electron 环境下回退到 localStorage。
 * 模块级单例确保同一窗口内所有组件共享同一份响应式状态。
 */

import { computed, ref, watch } from 'vue'

export interface AIBackend {
  id: string
  name: string
  apiKey: string
  baseURL: string
  model: string
}

interface BackendsState {
  backends: AIBackend[]
  activeId: string
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4.1-mini'

// 兼容旧版本的 localStorage 存储键，用于首次迁移
const LEGACY_API_KEY = 'openai-api-key'
const LEGACY_BASE_URL = 'openai-base-url'
const LS_BACKENDS = 'ai-backends'
const LS_ACTIVE_ID = 'ai-active-backend-id'

// 模块级单例状态
const backends = ref<AIBackend[]>([])
const activeId = ref<string>('')

let hydrated = false
let applyingRemote = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

function electron(): any {
  return (globalThis as any).electronAPI
}

function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  }
  catch {
    // ignore
  }
  return `backend-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

function createBackend(patch: Partial<AIBackend> = {}): AIBackend {
  return {
    id: generateId(),
    name: patch.name ?? '新后端',
    apiKey: patch.apiKey ?? '',
    baseURL: patch.baseURL ?? DEFAULT_BASE_URL,
    model: patch.model ?? DEFAULT_MODEL,
  }
}

function readLocal(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  }
  catch {
    return null
  }
}

// 从旧配置迁移出初始后端
function seedFromLegacy(): BackendsState {
  // 1) 之前的 localStorage 版多后端
  try {
    const rawList = readLocal(LS_BACKENDS)
    if (rawList) {
      const list = JSON.parse(rawList)
      if (Array.isArray(list) && list.length > 0) {
        return { backends: list, activeId: readLocal(LS_ACTIVE_ID) || list[0].id }
      }
    }
  }
  catch {
    // ignore
  }
  // 2) 旧的单一配置
  const seed = createBackend({
    name: '默认',
    apiKey: readLocal(LEGACY_API_KEY) || '',
    baseURL: readLocal(LEGACY_BASE_URL) || DEFAULT_BASE_URL,
  })
  return { backends: [seed], activeId: seed.id }
}

function normalizeActiveId(): void {
  if (!activeId.value || !backends.value.some(b => b.id === activeId.value)) {
    activeId.value = backends.value[0]?.id ?? ''
  }
}

// 应用一份完整状态（用于加载与跨窗口同步），期间抑制持久化以避免回环
function applyState(state: Partial<BackendsState> | null | undefined): void {
  applyingRemote = true
  backends.value = Array.isArray(state?.backends) ? state!.backends : []
  activeId.value = state?.activeId ?? ''
  normalizeActiveId()
  applyingRemote = false
}

function snapshot(): BackendsState {
  return {
    backends: backends.value.map(b => ({ ...b })),
    activeId: activeId.value,
  }
}

async function persist(): Promise<void> {
  const state = snapshot()
  const api = electron()
  if (api?.saveBackends) {
    try {
      await api.saveBackends(state)
      return
    }
    catch (error) {
      console.error('保存后端配置失败:', error)
    }
  }
  // 回退：localStorage（非 Electron 环境）
  try {
    localStorage.setItem(LS_BACKENDS, JSON.stringify(state.backends))
    localStorage.setItem(LS_ACTIVE_ID, state.activeId)
  }
  catch {
    // ignore
  }
}

function schedulePersist(delay = 300): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    void persist()
  }, delay)
}

async function hydrate(): Promise<void> {
  const api = electron()
  let state: BackendsState | null = null

  if (api?.loadBackends) {
    try {
      state = await api.loadBackends()
    }
    catch (error) {
      console.error('读取后端配置失败:', error)
    }
  }
  else {
    // 非 Electron：直接读 localStorage
    const rawList = readLocal(LS_BACKENDS)
    if (rawList) {
      try {
        const list = JSON.parse(rawList)
        if (Array.isArray(list) && list.length > 0) {
          state = { backends: list, activeId: readLocal(LS_ACTIVE_ID) || list[0].id }
        }
      }
      catch {
        // ignore
      }
    }
  }

  if (!state || !Array.isArray(state.backends) || state.backends.length === 0) {
    // 首次使用：迁移旧配置并持久化
    applyState(seedFromLegacy())
    hydrated = true
    await persist()
    return
  }

  applyState(state)
  hydrated = true
}

// 启动即加载
const ready = hydrate()

// 跨窗口：其他窗口保存后同步应用
{
  const api = electron()
  if (api?.onBackendsChanged) {
    api.onBackendsChanged((state: BackendsState) => {
      applyState(state)
    })
  }
}

// 本地变更时持久化（sync 保证在 applyingRemote 抑制窗口内触发，避免回环误存）
watch([backends, activeId], () => {
  if (!hydrated || applyingRemote) {
    return
  }
  schedulePersist()
}, { deep: true, flush: 'sync' })

export function useBackends() {
  const activeBackend = computed<AIBackend | null>(
    () => backends.value.find(b => b.id === activeId.value) ?? null,
  )

  function selectBackend(id: string): void {
    if (backends.value.some(b => b.id === id)) {
      activeId.value = id
    }
  }

  function addBackend(patch: Partial<AIBackend> = {}): AIBackend {
    const backend = createBackend(patch)
    backends.value = [...backends.value, backend]
    activeId.value = backend.id
    return backend
  }

  function updateBackend(id: string, patch: Partial<AIBackend>): void {
    backends.value = backends.value.map(b => (b.id === id ? { ...b, ...patch } : b))
  }

  function updateActiveBackend(patch: Partial<AIBackend>): void {
    if (activeId.value) {
      updateBackend(activeId.value, patch)
    }
  }

  function removeBackend(id: string): void {
    // 至少保留一个后端
    if (backends.value.length <= 1) {
      return
    }
    const next = backends.value.filter(b => b.id !== id)
    backends.value = next
    if (activeId.value === id) {
      activeId.value = next[0]?.id ?? ''
    }
  }

  return {
    backends,
    activeId,
    activeBackend,
    ready,
    selectBackend,
    addBackend,
    updateBackend,
    updateActiveBackend,
    removeBackend,
  }
}
