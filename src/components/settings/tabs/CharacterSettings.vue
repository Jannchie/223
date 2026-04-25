<script setup lang="ts">
import CharacterSelector from '../../CharacterSelector.vue'

defineProps<{ currentCharacterId: string | null, refreshKey?: number }>()
const emit = defineEmits<{
  (e: 'select', payload: any): void
  (e: 'edit', payload: any): void
  (e: 'delete', payload: any): void
  (e: 'create'): void
}>()
</script>

<template>
  <div>
    <CharacterSelector
      :key="refreshKey ?? 0"
      :current-character-id="currentCharacterId"
      @select="(c: any) => emit('select', c)"
      @edit="(c: any) => emit('edit', c)"
      @delete="(c: any) => emit('delete', c)"
      @create="() => emit('create')"
    />
  </div>
</template>
