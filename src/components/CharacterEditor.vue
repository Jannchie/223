<script setup lang="ts">
import type { Character } from '../types/chat'
import { characterService } from '../services/character-service'
import { onMounted, ref, watch, computed } from 'vue'

// Props
interface Props {
  character?: Character | null
  mode: 'create' | 'edit'
}

const props = defineProps<Props>()

// Emits
interface Emits {
  (e: 'save', character: Character): void
  (e: 'cancel'): void
  (e: 'delete', character: Character): void
}

const emit = defineEmits<Emits>()

// 表单数据
const formData = ref({
  name: '',
  systemPrompt: '',
  modelPath: '',
  avatar: '',
  description: ''
})

// 状态
const loading = ref(false)
const errors = ref<Record<string, string>>({})

// 可用的 Live2D 模型列表
const availableModels = ref([
  { path: '06-v2.1024/06-v2.model3.json', name: '06娘 v2' },
  // 可以在这里添加更多模型
])

// 移除复杂的性格特征输入

// 计算属性
const isEditMode = computed(() => props.mode === 'edit')
const title = computed(() => isEditMode.value ? '编辑角色' : '创建角色')

// 初始化表单数据
function initFormData() {
  if (props.character) {
    formData.value = {
      name: props.character.name,
      systemPrompt: props.character.systemPrompt,
      modelPath: props.character.modelPath || '',
      avatar: props.character.avatar || '',
      description: props.character.description || ''
    }
  } else {
    // 创建模式下的默认值
    formData.value = {
      name: '',
      systemPrompt: '',
      modelPath: '06-v2.1024/06-v2.model3.json',
      avatar: '',
      description: ''
    }
  }
  errors.value = {}
}

// 验证表单
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

// 保存角色
async function saveCharacter() {
  if (!validateForm()) {
    return
  }
  
  loading.value = true
  
  try {
    let savedCharacter: Character
    
    if (isEditMode.value && props.character) {
      // 更新现有角色
      savedCharacter = await characterService.updateCharacter(props.character.id, formData.value)
    } else {
      // 创建新角色
      savedCharacter = await characterService.createCharacter(formData.value)
    }
    
    emit('save', savedCharacter)
  } catch (error) {
    console.error('保存角色失败:', error)
    errors.value.general = error instanceof Error ? error.message : '保存失败'
  } finally {
    loading.value = false
  }
}

// 取消编辑
function cancelEdit() {
  emit('cancel')
}

// 删除角色
async function deleteCharacter() {
  if (!props.character) return
  
  if (confirm(`确定要删除角色 "${props.character.name}" 吗？此操作不可撤销。`)) {
    try {
      await characterService.deleteCharacter(props.character.id)
      emit('delete', props.character)
    } catch (error) {
      console.error('删除角色失败:', error)
      errors.value.general = error instanceof Error ? error.message : '删除失败'
    }
  }
}

// 移除了复杂的性格特征管理方法

// 监听 props 变化
watch([() => props.character, () => props.mode], () => {
  initFormData()
}, { immediate: true })

onMounted(() => {
  initFormData()
})
</script>

<template>
  <div class="character-editor">
    <div class="editor-header">
      <h3>{{ title }}</h3>
      <div class="header-actions">
        <button v-if="isEditMode" class="delete-btn" @click="deleteCharacter">
          <div class="i-carbon-delete text-16px" />
          删除
        </button>
      </div>
    </div>
    
    <div class="editor-content">
      <!-- 基本信息 -->
      <div class="form-section">
        <h4>基本信息</h4>
        
        <div class="form-field">
          <label>角色名称 *</label>
          <input
            v-model="formData.name"
            type="text"
            placeholder="输入角色名称"
            :class="{ error: errors.name }"
          >
          <div v-if="errors.name" class="error-message">{{ errors.name }}</div>
        </div>
        
        <div class="form-field">
          <label>角色描述</label>
          <input
            v-model="formData.description"
            type="text"
            placeholder="简短描述这个角色"
          >
        </div>
        
        <div class="form-field">
          <label>Live2D 模型</label>
          <select v-model="formData.modelPath">
            <option value="">选择模型</option>
            <option
              v-for="model in availableModels"
              :key="model.path"
              :value="model.path"
            >
              {{ model.name }}
            </option>
          </select>
        </div>
        
        <div class="form-field">
          <label>头像路径</label>
          <input
            v-model="formData.avatar"
            type="text"
            placeholder="/models/06-v2.1024/texture_00.png"
          >
        </div>
      </div>
      
      <!-- 系统提示词 -->
      <div class="form-section">
        <h4>系统提示词 *</h4>
        <div class="form-field">
          <textarea
            v-model="formData.systemPrompt"
            rows="15"
            placeholder="输入系统提示词，定义角色的性格、说话风格等..."
            :class="{ error: errors.systemPrompt }"
          />
          <div v-if="errors.systemPrompt" class="error-message">{{ errors.systemPrompt }}</div>
        </div>
      </div>
      
      <!-- 移除了复杂的性格特征设置，只保留系统提示词 -->
    </div>
    
    <!-- 错误信息 -->
    <div v-if="errors.general" class="error-banner">
      {{ errors.general }}
    </div>
    
    <!-- 操作按钮 -->
    <div class="editor-actions">
      <button class="cancel-btn" @click="cancelEdit" :disabled="loading">
        取消
      </button>
      <button class="save-btn" @click="saveCharacter" :disabled="loading">
        <div v-if="loading" class="loading-spinner" />
        {{ loading ? '保存中...' : '保存' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.character-editor {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 800px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  /* 美化滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}

.character-editor::-webkit-scrollbar {
  width: 6px;
}

.character-editor::-webkit-scrollbar-track {
  background: transparent;
}

.character-editor::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.character-editor::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.editor-header h3 {
  margin: 0;
  color: #333;
  font-size: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.delete-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #ffe6e6;
  color: #d32f2f;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.delete-btn:hover {
  background: #ffcccc;
}

.editor-content {
  margin-bottom: 24px;
}

.form-section {
  margin-bottom: 32px;
}

.form-section h4 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.form-field {
  margin-bottom: 20px;
}

.form-field label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
  font-size: 14px;
}

.form-field input,
.form-field select,
.form-field textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #4a9eff;
}

.form-field input.error,
.form-field textarea.error {
  border-color: #d32f2f;
}

.form-field textarea {
  resize: vertical;
  min-height: 200px;
  font-family: inherit;
  line-height: 1.5;
}

.error-message {
  margin-top: 4px;
  color: #d32f2f;
  font-size: 12px;
}

.error-banner {
  margin-bottom: 16px;
  padding: 12px;
  background: #ffe6e6;
  color: #d32f2f;
  border: 1px solid #ffcccc;
  border-radius: 6px;
  font-size: 14px;
}

/* 移除了复杂的标签和键值对组件样式 */

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.cancel-btn,
.save-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cancel-btn {
  background: #f0f0f0;
  color: #666;
}

.cancel-btn:hover:not(:disabled) {
  background: #e0e0e0;
}

.save-btn {
  background: #4a9eff;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #3a8eef;
}

.save-btn:disabled,
.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>