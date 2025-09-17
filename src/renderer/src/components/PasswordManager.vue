<template>
  <div class="password-manager">
    <!-- 头部 -->
    <div class="header">
      <div class="logo">
        <Icon name="lock" :width="24" :height="24" />
        <span>SecurePass</span>
      </div>
      <div class="actions">
        <button class="btn" @click="syncPasswords" type="button">
          <Icon name="sync" :width="24" :height="24" />
          <span>同步</span>
        </button>
        <button class="btn" @click="openSettings" type="button">
          <Icon name="cog" :width="24" :height="24" />
          <span>设置</span>
        </button>
      </div>
    </div>

    <!-- 搜索区域 -->
    <div class="search-area">
      <div class="search-box">
        <input
          type="text"
          placeholder="搜索密码..."
          v-model="searchQuery"
          @input="searchPasswords"
        >
        <button type="button">
          <Icon name="search" :width="24" :height="24" />
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div
          class="nav-item"
          :class="{ active: activeCategory === 'all' }"
          @click="setCategory('all')"
        >
          <Icon name="key" :width="24" :height="24" />
          <span>所有密码</span>
        </div>
        <div class="nav-item" @click="setCategory('favorite')">
          <Icon name="star" :width="24" :height="24" />
          <span>收藏夹</span>
        </div>

        <div class="category-title">分类</div>
        <div
          class="nav-item"
          :class="{ active: activeCategory === 'website' }"
          @click="setCategory('website')"
        >
          <Icon name="globe" :width="24" :height="24" />
          <span>网站</span>
        </div>
        <div
          class="nav-item"
          :class="{ active: activeCategory === 'payment' }"
          @click="setCategory('payment')"
        >
          <Icon name="credit-card" :width="24" :height="24" />
          <span>支付信息</span>
        </div>
        <div
          class="nav-item"
          :class="{ active: activeCategory === 'wifi' }"
          @click="setCategory('wifi')"
        >
          <Icon name="network" :width="24" :height="24" />
          <span>Wi-Fi</span>
        </div>
        <div
          class="nav-item"
          :class="{ active: activeCategory === 'app' }"
          @click="setCategory('app')"
        >
          <Icon name="mobile" :width="24" :height="24" />
          <span>应用</span>
        </div>

        <div class="category-title">工具</div>
        <div class="nav-item" @click="generatePassword">
          <Icon name="plus-circle" :width="24" :height="24" />
          <span>生成密码</span>
        </div>
        <div class="nav-item" @click="checkSecurity">
          <Icon name="shield" :width="24" :height="24" />
          <span>安全检查</span>
        </div>
      </div>

      <!-- 密码列表 -->
      <div class="password-list">
        <div class="section-title">
          <h2>{{ listTitle }}</h2>
          <button class="add-btn" @click="showAddPasswordModal" type="button">
            <Icon name="plus" :width="24" :height="24" />
            <span>添加新密码</span>
          </button>
        </div>

        <div class="password-grid">
          <PasswordCard
            v-for="password in filteredPasswords"
            :key="password.id"
            :password="password"
            @edit="editPassword"
            @delete="deletePassword"
            @toggle-favorite="toggleFavorite"
          />
        </div>
      </div>
    </div>

    <!-- 安全状态栏 -->
    <div class="security-bar">
      <div class="security-status">
        <Icon name="shield" :width="24" :height="24" />
        <span>保险库已锁定</span>
      </div>
      <div class="lock-status">
        <Icon name="clock" :width="24" :height="24" />
        <span>自动锁定: 5分钟</span>
      </div>
    </div>

    <!-- 密码模态框 -->
    <PasswordModal
      :visible="showModal"
      :password="editingPassword"
      :is-editing="!!editingPassword"
      @close="closeModal"
      @save="savePassword"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PasswordCard from './PasswordCard.vue'
import PasswordModal from './PasswordModal.vue'
import Icon from './Icon.vue'

// 定义接口
interface Password {
  id: number
  service: string
  username: string
  password: string
  category: string
  strength: string
  notes?: string
  url?: string
  createdAt: string
  updatedAt: string
  isFavorited?: boolean
  icon: string
  color: string
}

// 响应式数据
const passwords = ref<Password[]>([])
const searchQuery = ref('')
const activeCategory = ref('all')
const showModal = ref(false)
const editingPassword = ref<Password | null>(null)

// 计算属性
const filteredPasswords = computed(() => {
  let filtered = passwords.value

  // 按类别过滤
  if (activeCategory.value === 'favorite') {
    filtered = filtered.filter(p => p.isFavorited)
  } else if (activeCategory.value !== 'all') {
    filtered = filtered.filter(p => p.category === activeCategory.value)
  }

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(p =>
      p.service.toLowerCase().includes(query) ||
      p.username.toLowerCase().includes(query)
    )
  }

  return filtered
})

const listTitle = computed(() => {
  if (activeCategory.value === 'all') return `所有密码 (${filteredPasswords.value.length})`
  if (activeCategory.value === 'favorite') return `收藏夹 (${filteredPasswords.value.length})`
  const category = categories.find(c => c.id === activeCategory.value)
  return `${category?.name} (${filteredPasswords.value.length})`
})

// 分类数据
const categories = [
  { id: 'website', name: '网站', icon: 'globe' },
  { id: 'payment', name: '支付信息', icon: 'credit-card' },
  { id: 'wifi', name: 'Wi-Fi', icon: 'network' },
  { id: 'app', name: '应用', icon: 'mobile' }
]

// 生命周期
onMounted(async () => {
  await loadPasswords()
})

// 方法
const loadPasswords = async (): Promise<void> => {
  try {
    passwords.value = await window.api.password.getPasswords()
  } catch (error) {
    console.error('Failed to load passwords:', error)
  }
}

const setCategory = (category: string): void => {
  activeCategory.value = category
}

const searchPasswords = (): void => {
  // 搜索逻辑已在计算属性中处理
}

const showAddPasswordModal = (): void => {
  editingPassword.value = null
  showModal.value = true
}

const editPassword = (password: Password): void => {
  editingPassword.value = { ...password }
  showModal.value = true
}

const toggleFavorite = async (id: number): Promise<void> => {
  try {
    await window.api.password.toggleFavorite(id)
    await loadPasswords()
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
  }
}

const closeModal = (): void => {
  showModal.value = false
  editingPassword.value = null
}

const savePassword = async (passwordData: any): Promise<void> => {
  try {
    if (passwordData.id) {
      // 更新现有密码 - 修复参数传递方式
      await window.api.password.updatePassword(passwordData.id, passwordData)
    } else {
      // 新增密码
      await window.api.password.addPassword(passwordData)
    }
    // 确保在保存后刷新密码列表
    await loadPasswords()
    closeModal()
  } catch (error) {
    console.error('Failed to save password:', error)
    // 在实际应用中，这里应该显示错误消息给用户
  }
}

const deletePassword = async (id: number): Promise<void> => {
  try {
    await window.api.password.deletePassword(id)
    await loadPasswords()
  } catch (error) {
    console.error('Failed to delete password:', error)
    // 在实际应用中，这里应该显示错误消息给用户
  }
}

const syncPasswords = (): void => {
  console.log('Syncing passwords...')
}

const openSettings = (): void => {
  console.log('Opening settings...')
}

const generatePassword = (): void => {
  console.log('Generating password...')
}

const checkSecurity = (): void => {
  console.log('Checking security...')
}
</script>

<style scoped>
:root {
  --primary: #4361ee;
  --secondary: #3f37c9;
  --success: #4cc9f0;
  --warning: #f72585;
  --dark: #212529;
  --light: #f8f9fa;
  --gray: #6c757d;
  --border: #dee2e6;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

body {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
  color: var(--dark);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.password-manager {
  width: 100%;
  height: 100vh;
  background: white;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 头部样式 */
.header {
  background: var(--primary);
  color: white;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 600;
}

.logo i {
  font-size: 1.8rem;
}

.actions {
  display: flex;
  gap: 15px;
}

.btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 8px 15px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn i {
  font-size: 1.1rem;
}

/* 搜索区域 */
.search-area {
  padding: 20px;
  background: white;
  border-bottom: 1px solid var(--border);
}

.search-box {
  display: flex;
  background: var(--light);
  border-radius: 10px;
  overflow: hidden;
}

.search-box input {
  flex: 1;
  border: none;
  padding: 14px 20px;
  background: transparent;
  font-size: 1rem;
}

.search-box input:focus {
  outline: none;
}

.search-box button {
  background: var(--primary);
  color: white;
  border: none;
  padding: 0 20px;
  cursor: pointer;
}

/* 主内容区 */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 侧边栏 */
.sidebar {
  width: 250px;
  background: var(--light);
  border-right: 1px solid var(--border);
  padding: 20px 0;
  overflow-y: auto;
}

.nav-item {
  padding: 12px 25px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.nav-item:hover {
  background: rgba(67, 97, 238, 0.1);
}

.nav-item.active {
  background: rgba(67, 97, 238, 0.15);
  color: var(--primary);
  font-weight: 500;
  border-left: 3px solid var(--primary);
}

.nav-item i {
  width: 24px;
  text-align: center;
}

.category-title {
  padding: 20px 25px 10px;
  font-size: 0.85rem;
  text-transform: uppercase;
  color: var(--gray);
  letter-spacing: 1px;
}

/* 密码列表 */
.password-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title h2 {
  font-size: 1.4rem;
  font-weight: 600;
}

.add-btn {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}

.add-btn:hover {
  background: var(--secondary);
}

.password-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

/* 安全状态栏 */
.security-bar {
  background: rgba(67, 97, 238, 0.05);
  border-top: 1px solid var(--border);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}

.security-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--success);
}

.security-status.warning {
  color: var(--warning);
}

.lock-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 中等屏幕设备适配 (900px-1200px) */
@media (min-width: 900px) and (max-width: 1199px) {
  .password-manager {
    max-width: 100%;
  }

  .password-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 25px;
  }

  .header {
    padding: 25px;
  }

  .search-area {
    padding: 25px;
  }

  .password-list {
    padding: 25px;
  }

  .section-title h2 {
    font-size: 22px;
  }

  .password-card {
    padding: 25px;
  }
}

/* 大屏幕设备适配 */
@media (min-width: 1200px) {
  .password-manager {
    max-width: 100%;
  }

  .password-grid {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 25px;
  }

  .header {
    padding: 25px 30px;
  }

  .search-area {
    padding: 25px 30px;
  }

  .password-list {
    padding: 25px 30px;
  }

  .section-title h2 {
    font-size: 24px;
  }

  .password-card {
    padding: 25px;
  }
}

@media (min-width: 1400px) {
  .password-grid {
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 30px;
  }

  .header {
    padding: 30px 40px;
  }

  .search-area {
    padding: 30px 40px;
  }

  .password-list {
    padding: 30px 40px;
  }

  .section-title h2 {
    font-size: 28px;
  }

  .password-card {
    padding: 30px;
  }

  .card-title h3 {
    font-size: 20px;
  }

  .card-title p {
    font-size: 16px;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .password-manager {
    height: auto;
  }

  .main-content {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }

  .password-grid {
    grid-template-columns: 1fr;
  }
}
</style>
