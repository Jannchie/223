<script setup lang="ts">
import type { Character } from '../types/chat'
import { onMounted, ref, watch } from 'vue'
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

function charId(character: Character) {
  return String((character as any).id)
}

function isCurrent(character: Character) {
  return currentCharacter.value !== null && charId(currentCharacter.value) === charId(character)
}

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
      return characters.value.find(c => charId(c) === sid) || null
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
function selectCharacter(character: Character) {
  currentCharacter.value = character
  emit('select', character)
}

function handleEdit(character: Character) {
  emit('edit', character)
}

function handleDelete(character: Character) {
  if (characters.value.length <= 1) {
    // eslint-disable-next-line no-alert
    alert('不能删除最后一个角色')
    return
  }

  // eslint-disable-next-line no-alert
  if (confirm(`确定要删除角色 "${character.name}" 吗？`)) {
    emit('delete', character)
  }
}

function handleCreate() {
  emit('create')
}

onMounted(() => {
  loadCharacters()
})

watch(() => props.currentCharacterId, (newId) => {
  const sid = newId == null ? null : String(newId)
  if (sid === null) {
    return
  }
  const found = characters.value.find(c => charId(c) === sid) || null
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
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between px-1">
      <p class="text-sm font-medium text-highlighted">
        全部角色
      </p>
      <Button size="xs" variant="soft" icon="i-carbon-add" @click="handleCreate">
        新建角色
      </Button>
    </div>

    <div
      v-if="loading && characters.length === 0"
      class="rounded-xl border border-default bg-elevated p-4 text-sm text-muted"
    >
      正在加载角色…
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="character in characters"
        :key="charId(character)"
        role="button"
        tabindex="0"
        class="flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors"
        :class="isCurrent(character)
          ? 'border-primary bg-primary-soft'
          : 'border-default hover:border-accented hover:bg-elevated'"
        @click="selectCharacter(character)"
        @keydown.enter.prevent="selectCharacter(character)"
        @keydown.space.prevent="selectCharacter(character)"
      >
        <Avatar
          :src="character.avatar || undefined"
          :alt="character.name"
          icon="i-carbon-user-avatar"
          size="md"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ character.name }}
            </p>
            <Badge v-if="isCurrent(character)" color="primary" variant="outline" size="xs">
              当前
            </Badge>
          </div>
          <p class="mt-0.5 truncate text-xs text-muted">
            {{ character.description || '暂无描述' }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            square
            icon="i-carbon-edit"
            title="编辑角色"
            @click.stop="handleEdit(character)"
          />
          <Button
            color="error"
            variant="ghost"
            size="sm"
            square
            icon="i-carbon-trash-can"
            title="删除角色"
            :disabled="characters.length <= 1"
            @click.stop="handleDelete(character)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
