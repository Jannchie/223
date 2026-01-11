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

// 状态
const characters = ref<Character[]>([])
const loading = ref(false)
const showDropdown = ref(false)

// 当前选中的角色
const currentCharacter = ref<Character | null>(null)

// 加载角色列表
async function loadCharacters() {
  loading.value = true
  try {
    characters.value = await characterService.getAllCharacters()

    // 找到当前角色（优先使用传入ID；兼容数字/字符串；不匹配时尝试服务当前角色；最后回退第一个）
    const findById = (id: string | number | null | undefined) => {
      if (id === null || id === undefined) return null
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
    console.error('加载角色列表失败:', error)
  }
  finally {
    loading.value = false
  }
}

// 选择角色
function selectCharacter(character: Character) {
  currentCharacter.value = character
  showDropdown.value = false
  emit('select', character)
}

// 编辑角色
function editCharacter(character: Character, event: Event) {
  event.stopPropagation()
  showDropdown.value = false
  emit('edit', character)
}

// 删除角色
function deleteCharacter(character: Character, event: Event) {
  event.stopPropagation()
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

// 创建新角色
function createCharacter() {
  showDropdown.value = false
  emit('create')
}

// 切换下拉菜单
function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

// 点击外部关闭下拉菜单
function handleClickOutside(event: Event) {
  const target = event.target as Element
  const selector = document.querySelector('.character-selector')
  if (selector && !selector.contains(target)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  loadCharacters()
  document.addEventListener('click', handleClickOutside)
})

// 当父组件传入的当前角色ID变化时，同步选中项
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

// 刷新角色列表
function refresh() {
  loadCharacters()
}

// 暴露方法给父组件
defineExpose({
  refresh,
  loadCharacters,
})
</script>

<template>
  <div class="character-selector">
    <!-- 当前选中的角色显示 -->
    <div class="current-character" @click="toggleDropdown">
      <div class="character-info">
        <div v-if="currentCharacter" class="character-avatar">
          <img
            v-if="currentCharacter.avatar"
            :src="currentCharacter.avatar"
            :alt="currentCharacter.name"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          >
          <div v-else class="avatar-placeholder">
            {{ currentCharacter.name.charAt(0) }}
          </div>
        </div>
        <div class="character-details">
          <div class="character-name">
            {{ currentCharacter?.name || '选择角色' }}
          </div>
          <div v-if="currentCharacter?.description" class="character-description">
            {{ currentCharacter.description }}
          </div>
        </div>
    </div>
    <div class="dropdown-arrow" :class="{ open: showDropdown }">
      <UIcon name="i-carbon-chevron-down" class="text-14px" />
    </div>
  </div>

    <!-- 下拉菜单 -->
    <div v-if="showDropdown" class="dropdown-menu">
      <div class="menu-header">
        <span>选择角色</span>
        <button class="create-btn" title="创建新角色" @click="createCharacter">
          <UIcon name="i-carbon-add" class="text-16px" />
        </button>
      </div>

      <div v-if="loading" class="loading">
        加载中...
      </div>

      <div v-else class="character-list">
        <div
          v-for="character in characters"
          :key="character.id"
          class="character-item"
          :class="{ active: character.id === currentCharacter?.id }"
          @click="selectCharacter(character)"
        >
          <div class="character-avatar-small">
            <img
              v-if="character.avatar"
              :src="character.avatar"
              :alt="character.name"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            >
            <div v-else class="avatar-placeholder-small">
              {{ character.name.charAt(0) }}
            </div>
          </div>

          <div class="character-info-small">
            <div class="character-name-small">
              {{ character.name }}
            </div>
            <div v-if="character.description" class="character-description-small">
              {{ character.description }}
            </div>
          </div>

          <div class="character-actions">
          <button
            class="action-btn edit-btn"
            title="编辑"
            @click="editCharacter(character, $event)"
          >
            <UIcon name="i-carbon-edit" class="text-14px" />
          </button>
          <button
            v-if="characters.length > 1"
            class="action-btn delete-btn"
            title="删除"
            @click="deleteCharacter(character, $event)"
          >
            <UIcon name="i-carbon-delete" class="text-14px" />
          </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-selector {
  position: relative;
  width: 100%;
}

.current-character {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.current-character:hover {
  background: rgba(255, 255, 255, 1);
  border-color: #4a9eff;
}

.character-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.character-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #4a9eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
}

.character-details {
  flex: 1;
}

.character-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.character-description {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.dropdown-arrow {
  transition: transform 0.2s ease;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: 4px;
  max-height: 400px;
  overflow-y: auto;
  /* 美化滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}

.dropdown-menu::-webkit-scrollbar {
  width: 6px;
}

.dropdown-menu::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-menu::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.dropdown-menu::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.menu-header span {
  font-weight: 500;
  color: #333;
}

.create-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #4a9eff;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.create-btn:hover {
  background: #3a8eef;
}

.loading {
  padding: 20px;
  text-align: center;
  color: #666;
}

.character-list {
  max-height: 300px;
  overflow-y: auto;
  /* 美化滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #ccc transparent;
}

.character-list::-webkit-scrollbar {
  width: 6px;
}

.character-list::-webkit-scrollbar-track {
  background: transparent;
}

.character-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.character-list::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f0f0f0;
}

.character-item:hover {
  background: #f8f9fa;
}

.character-item.active {
  background: #e8f4ff;
  border-left: 3px solid #4a9eff;
}

.character-avatar-small {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.character-avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder-small {
  width: 100%;
  height: 100%;
  background: #4a9eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.character-info-small {
  flex: 1;
}

.character-name-small {
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.character-description-small {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.character-item:hover .character-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.edit-btn {
  background: #f0f0f0;
  color: #666;
}

.edit-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.delete-btn {
  background: #ffe6e6;
  color: #d32f2f;
}

.delete-btn:hover {
  background: #ffcccc;
  color: #b71c1c;
}
</style>
