<template>
  <div class="password-manager">
    <!-- 头部 -->
    <div class="header">
      <div class="logo">
        <i class="fas fa-lock"></i>
        <span>SecurePass</span>
      </div>
      <div class="actions">
        <button class="btn">
          <i class="fas fa-sync-alt"></i>
          <span>同步</span>
        </button>
        <button class="btn">
          <i class="fas fa-cog"></i>
          <span>设置</span>
        </button>
      </div>
    </div>

    <!-- 搜索区域 -->
    <div class="search-area">
      <div class="search-box">
        <input type="text" placeholder="搜索密码...">
        <button>
          <i class="fas fa-search"></i>
        </button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 侧边栏 -->
      <div class="sidebar">
        <div class="nav-item active">
          <i class="fas fa-key"></i>
          <span>所有密码</span>
        </div>
        <div class="nav-item">
          <i class="fas fa-star"></i>
          <span>收藏夹</span>
        </div>

        <div class="category-title">分类</div>
        <div class="nav-item">
          <i class="fas fa-globe"></i>
          <span>网站</span>
        </div>
        <div class="nav-item">
          <i class="fas fa-credit-card"></i>
          <span>支付信息</span>
        </div>
        <div class="nav-item">
          <i class="fas fa-network-wired"></i>
          <span>Wi-Fi</span>
        </div>
        <div class="nav-item">
          <i class="fas fa-mobile-alt"></i>
          <span>应用</span>
        </div>

        <div class="category-title">工具</div>
        <div class="nav-item">
          <i class="fas fa-plus-circle"></i>
          <span>生成密码</span>
        </div>
        <div class="nav-item">
          <i class="fas fa-shield-alt"></i>
          <span>安全检查</span>
        </div>
      </div>

      <!-- 密码列表 -->
      <div class="password-list">
        <div class="section-title">
          <h2>所有密码 (12)</h2>
          <button class="add-btn">
            <i class="fas fa-plus"></i>
            <span>添加新密码</span>
          </button>
        </div>

        <div class="password-grid">
          <!-- 密码卡片 1 -->
          <div class="password-card">
            <div class="card-header">
              <div class="icon-container">
                <i class="fab fa-google"></i>
              </div>
              <div class="card-title">
                <h3>Google 账户</h3>
                <p>john.doe@gmail.com</p>
              </div>
            </div>

            <div class="password-field">
              <input type="password" value="••••••••" readonly>
              <button class="toggle-password">
                <i class="fas fa-eye"></i>
              </button>
              <button class="copy-password">
                <i class="fas fa-copy"></i>
              </button>
            </div>

            <div class="strength-indicator strength-strong">
              <span>密码强度:</span>
              <div class="strength-dots">
                <div class="dot active"></div>
                <div class="dot active"></div>
                <div class="dot active"></div>
                <div class="dot active"></div>
              </div>
              <span>强</span>
            </div>

            <div class="card-actions">
              <button class="action-btn">
                <i class="fas fa-edit"></i>
                <span>编辑</span>
              </button>
              <button class="action-btn">
                <i class="fas fa-star"></i>
                <span>收藏</span>
              </button>
              <button class="action-btn">
                <i class="fas fa-trash-alt"></i>
                <span>删除</span>
              </button>
            </div>
          </div>

          <!-- 密码卡片 2 -->
          <div class="password-card">
            <div class="card-header">
              <div class="icon-container">
                <i class="fab fa-facebook"></i>
              </div>
              <div class="card-title">
                <h3>Facebook</h3>
                <p>john.doe@facebook.com</p>
              </div>
            </div>

            <div class="password-field">
              <input type="password" value="••••••••" readonly>
              <button class="toggle-password">
                <i class="fas fa-eye"></i>
              </button>
              <button class="copy-password">
                <i class="fas fa-copy"></i>
              </button>
            </div>

            <div class="strength-indicator strength-medium">
              <span>密码强度:</span>
              <div class="strength-dots">
                <div class="dot active"></div>
                <div class="dot active"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
              <span>中</span>
            </div>

            <div class="card-actions">
              <button class="action-btn">
                <i class="fas fa-edit"></i>
                <span>编辑</span>
              </button>
              <button class="action-btn">
                <i class="far fa-star"></i>
                <span>收藏</span>
              </button>
              <button class="action-btn">
                <i class="fas fa-trash-alt"></i>
                <span>删除</span>
              </button>
            </div>
          </div>

          <!-- 密码卡片 3 -->
          <div class="password-card">
            <div class="card-header">
              <div class="icon-container">
                <i class="fab fa-amazon"></i>
              </div>
              <div class="card-title">
                <h3>Amazon</h3>
                <p>john.doe@amazon.com</p>
              </div>
            </div>

            <div class="password-field">
              <input type="password" value="••••••••" readonly>
              <button class="toggle-password">
                <i class="fas fa-eye"></i>
              </button>
              <button class="copy-password">
                <i class="fas fa-copy"></i>
              </button>
            </div>

            <div class="strength-indicator strength-weak">
              <span>密码强度:</span>
              <div class="strength-dots">
                <div class="dot active"></div>
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
              <span>弱</span>
            </div>

            <div class="card-actions">
              <button class="action-btn">
                <i class="fas fa-edit"></i>
                <span>编辑</span>
              </button>
              <button class="action-btn">
                <i class="far fa-star"></i>
                <span>收藏</span>
              </button>
              <button class="action-btn">
                <i class="fas fa-trash-alt"></i>
                <span>删除</span>
              </button>
            </div>
          </div>

          <!-- 密码卡片 4 -->
          <div class="password-card">
            <div class="card-header">
              <div class="icon-container">
                <i class="fas fa-wifi"></i>
              </div>
              <div class="card-title">
                <h3>家庭 Wi-Fi</h3>
                <p>TP-Link_5G</p>
              </div>
            </div>

            <div class="password-field">
              <input type="password" value="••••••••" readonly>
              <button class="toggle-password">
                <i class="fas fa-eye"></i>
              </button>
              <button class="copy-password">
                <i class="fas fa-copy"></i>
              </button>
            </div>

            <div class="strength-indicator strength-strong">
              <span>密码强度:</span>
              <div class="strength-dots">
                <div class="dot active"></div>
                <div class="dot active"></div>
                <div class="dot active"></div>
                <div class="dot active"></div>
              </div>
              <span>强</span>
            </div>

            <div class="card-actions">
              <button class="action-btn">
                <i class="fas fa-edit"></i>
                <span>编辑</span>
              </button>
              <button class="action-btn">
                <i class="fas fa-star"></i>
                <span>收藏</span>
              </button>
              <button class="action-btn">
                <i class="fas fa-trash-alt"></i>
                <span>删除</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 安全状态栏 -->
    <div class="security-bar">
      <div class="security-status">
        <i class="fas fa-shield-alt"></i>
        <span>保险库已锁定</span>
      </div>
      <div class="lock-status">
        <i class="fas fa-clock"></i>
        <span>自动锁定: 5分钟</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// 定义接口
interface Password {
  id: number;
  service: string;
  username: string;
  password: string;
  category: string;
  strength: string;
  notes?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
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
  if (activeCategory.value !== 'all') {
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
  const category = categories.find(c => c.id === activeCategory.value)
  return `${category?.name} (${filteredPasswords.value.length})`
})

// 分类数据
const categories = [
  { id: 'website', name: '网站', icon: 'fas fa-globe' },
  { id: 'payment', name: '支付信息', icon: 'fas fa-credit-card' },
  { id: 'wifi', name: 'Wi-Fi', icon: 'fas fa-network-wired' },
  { id: 'app', name: '应用', icon: 'fas fa-mobile-alt' }
]

// 生命周期
onMounted(async () => {
  await loadPasswords()
})

// 方法
const loadPasswords = async () => {
  try {
    passwords.value = await window.api.password.getPasswords()
  } catch (error) {
    console.error('Failed to load passwords:', error)
  }
}

const setCategory = (category: string) => {
  activeCategory.value = category
}

const searchPasswords = () => {
  // 搜索逻辑已在计算属性中处理
}

const showAddPasswordModal = () => {
  editingPassword.value = null
  showModal.value = true
}

const editPassword = (password: Password) => {
  editingPassword.value = { ...password }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingPassword.value = null
}

const savePassword = async (passwordData: any) => {
  try {
    if (editingPassword.value?.id) {
      await window.api.password.updatePassword(editingPassword.value.id, passwordData)
    } else {
      await window.api.password.addPassword(passwordData)
    }
    await loadPasswords()
    closeModal()
  } catch (error) {
    console.error('Failed to save password:', error)
  }
}

const deletePassword = async (id: number) => {
  try {
    await window.api.password.deletePassword(id)
    await loadPasswords()
  } catch (error) {
    console.error('Failed to delete password:', error)
  }
}

const syncPasswords = () => {
  console.log('Syncing passwords...')
}

const openSettings = () => {
  console.log('Opening settings...')
}

const generatePassword = () => {
  console.log('Generating password...')
}

const checkSecurity = () => {
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
}

.add-btn:hover {
  background: var(--secondary);
}

.password-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

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
</style>
