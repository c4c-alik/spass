<template>
  <div class="password-card" :class="{'favorited': password.isFavorited}">
    <div class="card-header">
      <div class="icon-container" :style="{ background: password.color }">
        <i :class="password.icon"></i>
      </div>
      <div class="card-title">
        <h3>{{ password.title }}</h3>
        <p>{{ password.username }}</p>
      </div>
    </div>

    <div class="password-field">
      <input :type="showPassword ? 'text' : 'password'" :value="showPassword ? password.password : '••••••••'" readonly>
      <button class="toggle-password" @click="togglePasswordVisibility">
        <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
      </button>
      <button class="copy-password" @click="copyPassword">
        <i :class="copyStatus === 'success' ? 'fas fa-check' : 'fas fa-copy'"></i>
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
      <button class="action-btn" @click="$emit('edit', password)">
        <i class="fas fa-edit"></i>
        <span>编辑</span>
      </button>
      <button class="action-btn" @click="toggleFavorite">
        <i :class="password.isFavorited ? 'fas fa-star' : 'far fa-star'"></i>
        <span>{{ password.isFavorited ? '取消收藏' : '收藏' }}</span>
      </button>
      <button class="action-btn" @click="$emit('delete', password.id)">
        <i class="fas fa-trash-alt"></i>
        <span>删除</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps({
  password: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete', 'toggle-favorite'])

const showPassword = ref(false)
const copyStatus = ref('idle') // 'idle', 'copying', 'success'

const strengthText = computed(() => {
  const strengthMap = {
    'weak': '弱',
    'medium': '中',
    'strong': '强'
  }
  return strengthMap[props.password.strength]
})

function togglePasswordVisibility() {
  showPassword.value = !showPassword.value
}

function copyPassword() {
  navigator.clipboard.writeText(props.password.password)
    .then(() => {
      copyStatus.value = 'success'
      setTimeout(() => {
        copyStatus.value = 'idle'
      }, 2000)
    })
    .catch(err => {
      console.error('复制失败:', err)
    })
}

function toggleFavorite() {
  emit('toggle-favorite', props.password.id)
}

function isDotActive(index) {
  const activeDotsMap = {
    'weak': 1,
    'medium': 2,
    'strong': 4
  }
  return index <= activeDotsMap[props.password.strength]
}
</script>

<style scoped>
.password-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 20px;
  border: 1px solid var(--border);
  transition: all 0.3s ease;
}

.password-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08);
  border-color: var(--primary);
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
