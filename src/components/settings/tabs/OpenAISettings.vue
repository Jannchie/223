<script setup lang="ts">
import { computed } from 'vue'
import { useBackends } from '../../../composables/useBackends'

const {
  backends,
  activeId,
  activeBackend,
  selectBackend,
  addBackend,
  updateActiveBackend,
  removeBackend,
} = useBackends()

const active = computed(() => activeBackend.value)

function handleAdd() {
  addBackend({ name: `后端 ${backends.value.length + 1}` })
}

function handleRemove() {
  if (activeId.value) {
    removeBackend(activeId.value)
  }
}

function update(field: 'name' | 'apiKey' | 'baseURL' | 'model', value: unknown) {
  updateActiveBackend({ [field]: String(value ?? '') })
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <div class="mb-2 flex items-center justify-between px-1">
        <p class="text-sm font-medium text-highlighted">
          后端列表
        </p>
        <UButton size="xs" variant="soft" icon="i-carbon-add" @click="handleAdd">
          新建后端
        </UButton>
      </div>

      <div class="space-y-2">
        <button
          v-for="backend in backends"
          :key="backend.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
          :class="backend.id === activeId
            ? 'border-primary bg-muted'
            : 'border-default hover:border-accented'"
          @click="selectBackend(backend.id)"
        >
          <UIcon
            :name="backend.id === activeId ? 'i-carbon-radio-button-checked' : 'i-carbon-radio-button'"
            class="size-5 shrink-0"
            :class="backend.id === activeId ? 'text-primary' : 'text-dimmed'"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ backend.name || '未命名后端' }}
            </p>
            <p class="truncate text-xs text-muted">
              {{ backend.baseURL || '默认地址' }}
            </p>
          </div>
          <UBadge v-if="backend.id === activeId" color="primary" variant="soft" size="sm">
            使用中
          </UBadge>
        </button>
      </div>
    </div>

    <div v-if="active" class="space-y-4 rounded-xl border border-default p-4">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-highlighted">
          编辑「{{ active.name || '未命名后端' }}」
        </p>
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-carbon-trash-can"
          :disabled="backends.length <= 1"
          @click="handleRemove"
        >
          删除
        </UButton>
      </div>

      <UFormField label="名称">
        <UInput
          :model-value="active.name"
          placeholder="给这个后端起个名字"
          icon="i-carbon-tag"
          class="w-full"
          @update:model-value="(v: unknown) => update('name', v)"
        />
      </UFormField>

      <UFormField label="API Key" description="密钥仅保存在本地" required>
        <UInput
          :model-value="active.apiKey"
          type="password"
          placeholder="sk-..."
          autocomplete="off"
          icon="i-carbon-password"
          class="w-full"
          @update:model-value="(v: unknown) => update('apiKey', v)"
        />
      </UFormField>

      <UFormField label="Base URL" description="兼容 OpenAI 协议的服务地址">
        <UInput
          :model-value="active.baseURL"
          placeholder="https://api.openai.com/v1"
          icon="i-carbon-link"
          class="w-full"
          @update:model-value="(v: unknown) => update('baseURL', v)"
        />
      </UFormField>

      <UFormField label="模型">
        <UInput
          :model-value="active.model"
          placeholder="gpt-4.1-mini"
          icon="i-carbon-machine-learning-model"
          class="w-full"
          @update:model-value="(v: unknown) => update('model', v)"
        />
      </UFormField>
    </div>
  </div>
</template>
