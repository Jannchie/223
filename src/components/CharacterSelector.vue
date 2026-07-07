<script setup lang="ts">
import type { Character } from '../types/chat'
import { computed, onMounted, ref, watch } from 'vue'
import { characterService } from '../services/character-service'

// Props
interface Props {
  currentCharacterId?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

// Emits
interface Emits {
  (e: 'select', character: Character): void
  (e: 'edit', character: Character): void
  (e: 'delete', character: Character): void
  (e: 'create'): void
}

// State
const characters = ref<Character[]>([])
const loading = ref(false)

// Current selection
const currentCharacter = ref<Character | null>(null)
const selectedId = ref<string | null>(null)

const selectItems = computed(() => {
  return characters.value.map(character => ({
    label: character.name,
    value: String((character as any).id),
    description: character.description || undefined,
  }))
})

// Load characters
async function loadCharacters() {
  loading.value = true
  try {
    characters.value = await characterService.getAllCharacters()

    const findById = (id: string | number | null | undefined) => {
      if (id === null || id === undefined) {
        return null
      }
      const sid = String(id)
      return characters.value.find(c => String((c as any).id) === sid) || null
    }

    let selected: Character | null = null
    selected = findById(props.currentCharacterId)
    if (!selected) {
      try {
        const svc = await characterService.getCurrentCharacterAsync()
        selected = findById(svc?.id)
      }
      catch {
        // ignore
      }
    }
    if (!selected && characters.value.length > 0) {
      selected = characters.value[0]
    }
    currentCharacter.value = selected
  }
  catch (error) {
    console.error('Failed to load characters:', error)
  }
  finally {
    loading.value = false
  }
}

// Select character
function selectCharacterById(id: string | null) {
  if (!id) {
    return
  }
  const character = characters.value.find(c => String((c as any).id) === id)
  if (!character) {
    return
  }
  currentCharacter.value = character
  emit('select', character)
}

function handleEdit() {
  if (!currentCharacter.value) {
    return
  }
  emit('edit', currentCharacter.value)
}

function handleDelete() {
  if (!currentCharacter.value) {
    return
  }
  if (characters.value.length <= 1) {
    // eslint-disable-next-line no-alert
    alert('不能删除最后一个角色')
    return
  }

  // eslint-disable-next-line no-alert
  if (confirm(`确定要删除角色 "${currentCharacter.value.name}" 吗？`)) {
    emit('delete', currentCharacter.value)
  }
}

function handleCreate() {
  emit('create')
}

onMounted(() => {
  loadCharacters()
})

watch(currentCharacter, (character) => {
  selectedId.value = character ? String((character as any).id) : null
})

watch(() => props.currentCharacterId, (newId) => {
  const sid = newId == null ? null : String(newId)
  if (sid === null) {
    return
  }
  const found = characters.value.find(c => String((c as any).id) === sid) || null
  if (found) {
    currentCharacter.value = found
  }
})

// Refresh list
function refresh() {
  loadCharacters()
}

// Expose to parent
defineExpose({
  refresh,
  loadCharacters,
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="currentCharacter"
      class="flex items-center gap-3 rounded-xl border border-default bg-elevated/50 p-3"
    >
      <UAvatar
        :src="currentCharacter.avatar || undefined"
        :alt="currentCharacter.name"
        icon="i-carbon-user-avatar"
        size="lg"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-highlighted">
          {{ currentCharacter.name }}
        </p>
        <p class="truncate text-xs text-muted">
          {{ currentCharacter.description || '暂无描述' }}
        </p>
      </div>
      <UBadge color="primary" variant="soft" size="sm">
        当前
      </UBadge>
    </div>

    <UFormField label="切换角色">
      <USelect
        v-model="selectedId"
        class="w-full"
        :items="selectItems"
        :disabled="loading"
        :loading="loading"
        icon="i-carbon-user-multiple"
        placeholder="选择角色"
        @update:model-value="selectCharacterById"
      />
    </UFormField>

    <div class="flex gap-2 flex-wrap">
      <UButton color="primary" size="sm" icon="i-carbon-add" @click="handleCreate">
        新建角色
      </UButton>
      <UButton
        color="neutral"
        size="sm"
        variant="soft"
        icon="i-carbon-edit"
        :disabled="!currentCharacter"
        @click="handleEdit"
      >
        编辑
      </UButton>
      <UButton
        color="error"
        size="sm"
        variant="ghost"
        icon="i-carbon-trash-can"
        class="ml-auto"
        :disabled="!currentCharacter || characters.length <= 1"
        @click="handleDelete"
      >
        删除
      </UButton>
    </div>
  </div>
</template>
