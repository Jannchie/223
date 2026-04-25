<script setup lang="ts">
import type { Character } from '../types/chat'
import { computed, onMounted, ref, watch } from 'vue'
import { characterService } from '../services/character-service'

// Props
interface Props {
  character?: Character | null
  mode: 'create' | 'edit'
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

// Emits
interface Emits {
  (e: 'save', character: Character): void
  (e: 'cancel'): void
  (e: 'delete', character: Character): void
}

// Form data
const formData = ref({
  name: '',
  systemPrompt: '',
  modelPath: '',
  avatar: '',
  description: '',
})

// State
const loading = ref(false)
const errors = ref<Record<string, string>>({})

// Live2D model list
const availableModels = ref([
  { path: '06-v2.1024/06-v2.model3.json', name: '06姬 v2' },
  { path: 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@master/Samples/Resources/Hiyori/Hiyori.model3.json', name: 'Hiyori (官方示例)' },
  { path: 'custom', name: '自定义路径...' },
])

const modelOptions = computed(() => availableModels.value.map(model => ({
  label: model.name,
  value: model.path,
})))

// Custom model path
const isCustomPath = ref(false)
const customModelPath = ref('')

// Computed
const isEditMode = computed(() => props.mode === 'edit')
const title = computed(() => isEditMode.value ? '编辑角色' : '创建角色')

// Initialize form
function initFormData() {
  const characterModelPath = props.character?.modelPath || '06-v2.1024/06-v2.model3.json'

  formData.value = props.character
    ? {
        name: props.character.name,
        systemPrompt: props.character.systemPrompt,
        modelPath: characterModelPath,
        avatar: props.character.avatar || '',
        description: props.character.description || '',
      }
    : {
        name: '',
        systemPrompt: '',
        modelPath: '06-v2.1024/06-v2.model3.json',
        avatar: '',
        description: '',
      }

  const isPresetModel = availableModels.value.some(model => model.path === characterModelPath && model.path !== 'custom')

  if (!isPresetModel && characterModelPath) {
    isCustomPath.value = true
    customModelPath.value = characterModelPath
    formData.value.modelPath = characterModelPath
  }
  else {
    isCustomPath.value = false
    customModelPath.value = characterModelPath
  }

  errors.value = {}
}

// Validate
function validateForm(): boolean {
  errors.value = {}

  if (!formData.value.name.trim()) {
    errors.value.name = '角色名称不能为空'
  }

  if (!formData.value.systemPrompt.trim()) {
    errors.value.systemPrompt = '系统提示词不能为空'
  }

  return Object.keys(errors.value).length === 0
}

// Save
async function saveCharacter() {
  if (!validateForm()) {
    return
  }

  loading.value = true

  try {
    const savedCharacter: Character = isEditMode.value && props.character
      ? await characterService.updateCharacter(props.character.id, formData.value)
      : await characterService.createCharacter(formData.value)

    emit('save', savedCharacter)
  }
  catch (error) {
    console.error('Save character failed:', error)
    errors.value.general = error instanceof Error ? error.message : '保存失败'
  }
  finally {
    loading.value = false
  }
}

// Cancel
function cancelEdit() {
  emit('cancel')
}

// Delete
async function deleteCharacter() {
  if (!props.character) {
    return
  }

  // eslint-disable-next-line no-alert
  if (confirm(`确定要删除角色 "${props.character.name}" 吗？此操作不可撤销。`)) {
    try {
      await characterService.deleteCharacter(props.character.id)
      emit('delete', props.character)
    }
    catch (error) {
      console.error('Delete character failed:', error)
      errors.value.general = error instanceof Error ? error.message : '删除失败'
    }
  }
}

// Model selection watcher
watch(() => formData.value.modelPath, (newPath) => {
  if (newPath === 'custom') {
    isCustomPath.value = true
    formData.value.modelPath = customModelPath.value
  }
  else {
    isCustomPath.value = false
    customModelPath.value = newPath
  }
})

// Custom path watcher
watch(() => customModelPath.value, (newPath) => {
  if (isCustomPath.value) {
    formData.value.modelPath = newPath
  }
})

// Props watcher
watch([() => props.character, () => props.mode], () => {
  initFormData()
}, { immediate: true })

onMounted(() => {
  initFormData()
})
</script>

<template>
  <UCard class="character-editor">
    <template #header>
      <div class="editor-header">
        <div class="editor-title">
          {{ title }}
        </div>
        <UButton
          v-if="isEditMode"
          color="error"
          variant="soft"
          size="sm"
          icon="i-carbon-delete"
          @click="deleteCharacter"
        >
          删除
        </UButton>
      </div>
    </template>

    <div class="editor-content">
      <div class="form-section">
        <div class="section-title">
          基本信息
        </div>

        <UFormField label="角色名称" required :error="errors.name">
          <UInput v-model="formData.name" placeholder="输入角色名称" />
        </UFormField>

        <UFormField label="角色描述">
          <UInput v-model="formData.description" placeholder="简短描述这个角色" />
        </UFormField>

        <UFormField label="Live2D 模型">
          <USelect
            v-if="!isCustomPath"
            v-model="formData.modelPath"
            :items="modelOptions"
            placeholder="选择模型"
          />

          <div v-else class="custom-path-input">
            <UInput
              v-model="customModelPath"
              placeholder="输入模型文件路径或 URL"
            />
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              @click="isCustomPath = false; formData.modelPath = '06-v2.1024/06-v2.model3.json'"
            >
              返回预设
            </UButton>
          </div>

          <div v-if="formData.modelPath" class="model-path-display">
            <small>当前模型路径: {{ formData.modelPath }}</small>
          </div>
        </UFormField>

        <UFormField label="头像路径">
          <UInput v-model="formData.avatar" placeholder="/models/06-v2.1024/texture_00.png" />
        </UFormField>
      </div>

      <div class="form-section">
        <div class="section-title">
          系统提示词 *
        </div>
        <UFormField :error="errors.systemPrompt">
          <UTextarea
            v-model="formData.systemPrompt"
            :rows="15"
            placeholder="输入系统提示词，定义角色的性格、说话风格等..."
          />
        </UFormField>
      </div>

      <UAlert
        v-if="errors.general"
        color="error"
        variant="soft"
        title="操作失败"
        :description="errors.general"
      />
    </div>

    <template #footer>
      <div class="editor-actions">
        <UButton color="neutral" variant="ghost" :disabled="loading" @click="cancelEdit">
          取消
        </UButton>
        <UButton color="primary" :loading="loading" @click="saveCharacter">
          {{ loading ? '保存中...' : '保存' }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>

<style scoped>
.character-editor {
  max-width: 820px;
  width: min(92vw, 820px);
  max-height: 80vh;
  overflow: hidden;
}

:deep(.character-editor [data-slot="body"]) {
  overflow: auto;
  max-height: calc(80vh - 160px);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.editor-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--ui-text-highlighted);
}

.editor-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ui-text);
}

.custom-path-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.model-path-display {
  margin-top: 4px;
}

.model-path-display small {
  color: var(--ui-text-muted);
  font-size: 12px;
  word-break: break-all;
}

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
