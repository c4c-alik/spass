<template>
  <!-- 密码卡片组件，继承全局card样式并添加特定样式 -->
  <div class="password-card card" :class="{ favorited: password.isFavorited }">
    <div class="card-header">
      <div class="icon-container" :style="{ background: password.color }">
        <img 
          v-if="faviconUrl && !showDefaultIcon" 
          :src="faviconUrl" 
          :width="24" 
          :height="24" 
          alt="Website Icon"
          @error="onFaviconError"
        />
        <Icon 
          v-else 
          :name="password.icon" 
          :width="24" 
          :height="24" 
        />
      </div>
      <div class="card-title">
        <h3>{{ password.service }}</h3>
        <p v-if="password.username">{{ password.username }}</p>
        <p v-else class="no-username">未设置用户名</p>
      </div>
      <div class="category-tag" v-if="password.group">
        <Icon :name="getCategoryIcon(password.group)" :width="24" :height="24" />
        <span :title="getCategoryName(password.group)">{{ getCategoryName(password.group) }}</span>
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
        <Icon
          :name="password.isFavorited ? 'star-filled' : 'star'"
          :width="24"
          :height="24"
          :class="password.isFavorited ? 'star-filled-icon' : 'star-icon'"
        />
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
import { computed, ref, onMounted, watch } from 'vue'
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

// 分类映射
const categoryMap = {
  website: '网站',
  payment: '支付信息',
  wifi: 'Wi-Fi',
  app: '应用',
  other: '其他'
}

// 分类图标映射
const categoryIcons = {
  website: 'globe',
  payment: 'credit-card',
  wifi: 'wifi',
  app: 'mobile',
  other: 'folder'
}

// 响应式数据
const showPassword = ref(false) // 控制密码可见性
const copyStatus = ref('idle') // 复制状态：'idle' | 'copying' | 'success'
const decryptedPassword = ref('') // 解密后的密码
const faviconUrl = ref('') // 网站图标URL
const showDefaultIcon = ref(false) // 是否显示默认图标
const loadingFavicon = ref(false) // 是否正在加载favicon

// favicon缓存（限制最多缓存50个）
const faviconCache = new Map<string, string>()
const MAX_CACHE_SIZE = 50

// 添加到缓存并控制大小
function addToFaviconCache(key: string, value: string): void {
  // 如果缓存已满，删除最旧的条目
  if (faviconCache.size >= MAX_CACHE_SIZE) {
    const firstKey = faviconCache.keys().next().value
    if (firstKey) {
      faviconCache.delete(firstKey)
    }
  }
  
  faviconCache.set(key, value)
}

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
 * 获取分类名称
 * @param category 分类ID
 * @returns 分类名称
 */
function getCategoryName(category: string): string {
  return categoryMap[category] || category
}

/**
 * 获取分类图标
 * @param category 分类ID
 * @returns 分类图标名称
 */
function getCategoryIcon(category: string): string {
  return categoryIcons[category] || 'folder'
}

/**
 * 验证URL是否有效
 * @param url 待验证的URL
 * @returns 是否为有效URL
 */
function isValidUrl(url: string): boolean {
  if (!url) return false
  try {
    // 如果URL没有协议，自动添加https://
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url
    }
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 打开链接
 * @param url 链接URL
 */
function openLink(url: string): void {
  if (url) {
    // 如果URL没有协议，自动添加https://
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * 获取网站favicon
 * 通过主进程获取，避免CSP限制
 */
async function loadFavicon(): Promise<void> {
  // 防止在短时间内重复请求
  if (loadingFavicon.value) {
    return
  }
  
  try {
    loadingFavicon.value = true
    
    // 如果密码记录中已经有favicon数据，直接使用
    if (props.password.favicon) {
      faviconUrl.value = props.password.favicon
      showDefaultIcon.value = false
      return
    }
    
    if (!props.password.url) {
      showDefaultIcon.value = true
      return
    }
    
    // 检查缓存
    if (faviconCache.has(props.password.url)) {
      faviconUrl.value = faviconCache.get(props.password.url)!
      showDefaultIcon.value = false
      return
    }

    const url = await window.api.password.getWebsiteFavicon(props.password.url)
    if (url) {
      faviconUrl.value = url
      showDefaultIcon.value = false
      // 添加到缓存
      addToFaviconCache(props.password.url, url)
    } else {
      showDefaultIcon.value = true
    }
  } catch (error) {
    console.error('获取网站favicon失败:', error)
    showDefaultIcon.value = true
  } finally {
    loadingFavicon.value = false
  }
}

/**
 * 当favicon加载失败时调用
 */
function onFaviconError(): void {
  showDefaultIcon.value = true
}

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

// 在组件挂载时尝试获取网站图标
onMounted(() => {
  loadFavicon()
})

// 监听password.url的变化
watch(
  () => props.password.url,
  () => {
    loadFavicon()
  }
)

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

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-row h3 {
  font-size: 1.1rem;
  margin: 0;
}

.title-icons {
  display: flex;
  gap: 5px;
}

.title-icon {
  color: var(--primary);
  cursor: help;
}

.link-icon {
  cursor: pointer;
}

.link-icon:hover {
  opacity: 0.8;
}

.category-tag {
  display: flex;
  align-items: center;
  gap: 5px; /* 子元素之间留有5px的空隙 */
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.card-title p {
  color: var(--gray);
  font-size: 0.9rem;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-icon {
  color: var(--primary);
}

/* 服务名称显示 */
.password-details {
  margin-bottom: 15px;
  padding: 12px 15px;
  background-color: var(--light);
  border-radius: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
}

.detail-icon {
  margin-right: 8px;
  color: var(--primary);
  min-width: 16px;
}

.detail-value {
  flex: 1;
  color: var(--gray);
  word-break: break-all;
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

/* 收藏按钮特殊样式 */
.action-btn:nth-child(2) .star-filled-icon {
  color: #ffc107; /* 黄色 */
}

.action-btn:nth-child(2):hover .star-filled-icon {
  color: #ffc107;
}

.action-btn:nth-child(2):hover {
  background: rgba(255, 193, 7, 0.1);
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

.strength-medium .dot:nth-child(-n + 2) {
  background: orange;
}

.strength-strong .dot {
  background: var(--success);
}
</style>
