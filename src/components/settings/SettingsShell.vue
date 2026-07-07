<script setup lang="ts">
import type { GazeAtUserConfig } from '../../composables/useGaze'
import type { RoastResult, ScreenshotRoastConfig } from '../../utils/screenshot-roast'
import { computed } from 'vue'
import SettingsBody from './SettingsBody.vue'

type SettingsTab = 'openai' | 'character' | 'roast' | 'gaze'

interface BodyProps {
  activeTab: SettingsTab
  currentCharacterId: string | null
  characterRefreshKey?: number
  roastConfig: ScreenshotRoastConfig
  isRoasting: boolean
  currentRoast: RoastResult | null
  roastHistory: RoastResult[]
  gazeAtUserConfig: GazeAtUserConfig
}

const props = defineProps<{
  activeTab: SettingsTab
  cancelLabel: string
  bodyProps: BodyProps
  bodyHandlers: Record<string, (...args: any[]) => void>
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', tab: SettingsTab): void
  (e: 'cancel'): void
  (e: 'save'): void
}>()

const tabs = [
  {
    value: 'character' as const,
    label: '角色管理',
    description: '挑选、创建和编辑你的桌面伙伴',
    icon: 'i-carbon-user-avatar',
  },
  {
    value: 'openai' as const,
    label: 'OpenAI 设置',
    description: '管理 OpenAI 兼容的模型后端与密钥',
    icon: 'i-carbon-api',
  },
  {
    value: 'roast' as const,
    label: '截图吐槽',
    description: '定时截屏，让她对你的屏幕内容发表评论',
    icon: 'i-carbon-chat',
  },
  {
    value: 'gaze' as const,
    label: '目光跟踪',
    description: '让角色时不时看向你，更有陪伴感',
    icon: 'i-carbon-view',
  },
]

const currentTab = computed(() => tabs.find(t => t.value === props.activeTab) ?? tabs[0])
</script>

<template>
  <div class="flex h-full w-full min-h-0 flex-1">
    <!-- 侧栏导航 -->
    <aside class="flex w-44 shrink-0 flex-col border-r border-default bg-elevated">
      <div class="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon name="i-carbon-settings" class="size-4.5" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold leading-tight text-highlighted">
            NiNiSan
          </p>
          <p class="text-[11px] leading-tight text-muted">
            设置
          </p>
        </div>
      </div>

      <nav class="flex flex-col gap-1 px-2.5">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors"
          :class="tab.value === activeTab
            ? 'bg-primary-soft font-medium text-primary'
            : 'text-muted hover:bg-muted hover:text-highlighted'"
          @click="emit('update:activeTab', tab.value)"
        >
          <Icon :name="tab.icon" class="size-4.5 shrink-0" />
          <span class="truncate">{{ tab.label }}</span>
        </button>
      </nav>
    </aside>

    <!-- 内容区 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="px-6 pb-4 pt-6">
        <h2 class="text-lg font-semibold leading-tight text-highlighted">
          {{ currentTab.label }}
        </h2>
        <p class="mt-1 text-[13px] text-muted">
          {{ currentTab.description }}
        </p>
      </header>

      <main class="flex-1 overflow-y-auto px-6 pb-6">
        <SettingsBody v-bind="bodyProps" v-on="bodyHandlers" />
      </main>

      <footer class="flex items-center justify-end gap-2 border-t border-default px-6 py-3.5">
        <Button color="neutral" variant="ghost" @click="emit('cancel')">
          {{ cancelLabel }}
        </Button>
        <Button color="primary" icon="i-carbon-checkmark" @click="emit('save')">
          保存
        </Button>
      </footer>
    </div>
  </div>
</template>
