<template>
  <!-- 密码卡片组件，继承全局card样式并添加特定样式 -->
  <div class="password-card card" :class="{ favorited: password.isFavorited }">
    <div class="card-header">
      <div class="icon-container" :style="{ background: password.color }">
        <Icon :name="password.icon" :width="24" :height="24" />
      </div>
      <div class="card-title">
        <h3>{{ password.title }}</h3>
        <p>{{ password.username }}</p>
      </div>
    </div>

    <div class="password-field">
      <input :type="showPassword ? 'text' : 'password'" :value="displayPassword" readonly />
      <button class="toggle-password" type="button" @click="togglePasswordVisibility">
        <Icon :name="showPassword ? 'eye-off' : 'eye'" :width="24" :height="24" />
      </button>
      <button class="copy-password" type="button" @click="copyPassword">
        <Icon :name="copyStatus === 'success' ? 'check' : 'copy'" :width="24" :height="24" />
      </button>
    </div>

    <div class="strength-indicator" :class="'strength-' + password.strength">
      <span>密码强度:</span>
      <div class="strength-dots">
        <div v-for="i in 4" :key="i" class="dot" :class="{ active: isDotActive(i) }"></div>
      </div>
      <span>{{ strengthText }}</span>
    </div>

    <div class="card-actions">
      <button class="action-btn" type="button" @click="$emit('edit', password)">
        <Icon name="edit" :width="24" :height="24" />
        <span>编辑</span>
      </button>
      <button class="action-btn" type="button" @click="toggleFavorite">
        <Icon :name="password.isFavorited ? 'star-filled' : 'star'" :width="24" :height="24" />
        <span>{{ password.isFavorited ? '取消收藏' : '收藏' }}</span>
      </button>
      <button class="action-btn" type="button" @click="$emit('delete', password.id)">
        <Icon name="trash" :width="24" :height="24" />
        <span>删除</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Icon from './Icon.vue'

// 定义组件属性
const props = defineProps({
  password: {
    type: Object,
    required: true
  }
})

// 定义事件发射器
const emit = defineEmits(['edit', 'delete', 'toggle-favorite'])

// 响应式数据
const showPassword = ref(false) // 控制密码可见性
const copyStatus = ref('idle') // 复制状态：'idle' | 'copying' | 'success'
const decryptedPassword = ref('') // 解密后的密码

// 计算显示的密码（明文或密文）
const displayPassword = computed(() => {
  if (showPassword.value) {
    return decryptedPassword.value || '••••••••'
  } else {
    return '••••••••'
  }
})

// 计算密码强度文本
const strengthText = computed(() => {
  const strengthMap = {
    weak: '弱',
    medium: '中',
    strong: '强'
  }
  return strengthMap[props.password.strength]
})

/**
 * 切换密码可见性
 * 当用户点击眼睛图标时，如果需要显示明文且尚未解密，则进行解密
 */
async function togglePasswordVisibility(): void {
  showPassword.value = !showPassword.value

  // 如果需要显示明文且尚未解密，则进行解密
  if (showPassword.value && !decryptedPassword.value) {
    try {
      decryptedPassword.value = await window.api.password.decryptPassword(props.password.password)
    } catch (error) {
      console.error('解密密码失败:', error)
      decryptedPassword.value = '解密失败'
    }
  }
}

/**
 * 复制密码到剪贴板
 * 如果尚未解密，先解密再复制
 */
async function copyPassword(): void {
  try {
    // 如果尚未解密，先解密
    if (!decryptedPassword.value) {
      decryptedPassword.value = await window.api.password.decryptPassword(props.password.password)
    }

    navigator.clipboard.writeText(decryptedPassword.value).then(() => {
      copyStatus.value = 'success'
      setTimeout(() => {
        copyStatus.value = 'idle'
      }, 2000)
    })
  } catch (error) {
    console.error('复制失败:', error)
  }
}

/**
 * 切换收藏状态
 */
function toggleFavorite(): void {
  emit('toggle-favorite', props.password.id)
}

/**
 * 判断强度点是否激活
 * @param index 点的索引
 * @returns 是否激活
 */
function isDotActive(index: number): boolean {
  const activeDotsMap = {
    weak: 1,
    medium: 2,
    strong: 4
  }
  return index <= activeDotsMap[props.password.strength]
}
</script>

<style scoped>
/* 继承全局card样式，只定义密码卡片特有样式 */
.password-card {
  padding: 25px;
  border: 1px solid var(--border);
  transition: all 0.3s ease;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.icon-container {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
}

.card-title {
  flex: 1;
}

.card-title h3 {
  font-size: 1.1rem;
  margin-bottom: 4px;
}

.card-title p {
  color: var(--gray);
  font-size: 0.9rem;
}

.password-field {
  background: var(--light);
  border-radius: 8px;
  padding: 12px 15px;
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.password-field input {
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  color: var(--dark);
}

.password-field input:focus {
  outline: none;
}

.password-field button {
  background: transparent;
  border: none;
  color: var(--gray);
  cursor: pointer;
  padding: 5px;
}

.password-field button:hover {
  color: var(--primary);
}

.card-actions {
  display: flex;
  justify-content: space-between;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--gray);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(67, 97, 238, 0.1);
  color: var(--primary);
}

.strength-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  margin-top: 10px;
  color: var(--gray);
}

.strength-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
}

.dot.active {
  background: var(--success);
}

.strength-weak .dot.active {
  background: var(--warning);
}

.strength-medium .dot:nth-child(-n+2) {
  background: orange;
}

.strength-strong .dot {
  background: var(--success);
}
</style>
