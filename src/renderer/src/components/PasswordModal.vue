<template>
  <div v-if="visible" class="password-modal-overlay" @click.self="closeModal">
    <div class="password-modal card">
      <div class="modal-header">
        <h2>{{ isEditing ? '编辑密码' : '添加新密码' }}</h2>
        <button class="close-btn" type="button" @click="closeModal">
          <Icon name="x" :width="24" :height="24" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="title">服务名称</label>
          <input
            id="title"
            v-model="formData.title"
            type="text"
            placeholder="例如：Google、Facebook"
            required
          />
        </div>

        <div class="form-group">
          <label for="username">用户名/邮箱</label>
          <input
            id="username"
            v-model="formData.username"
            type="text"
            placeholder="输入用户名或邮箱"
            required
            spellcheck="false"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <div class="password-input-group">
            <input
              id="password"
              v-model="formData.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="输入密码"
              required
            />
            <button class="toggle-password" type="button" @click="showPassword = !showPassword">
              <Icon :name="showPassword ? 'eye-off' : 'eye'" :width="24" :height="24" />
            </button>
            <button class="generate-password" type="button" @click="generatePassword">
              <Icon name="dice" :width="24" :height="24" />
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="url">网站地址 (可选)</label>
          <input id="url" v-model="formData.url" type="url" placeholder="https://" />
        </div>

        <div class="form-group">
          <label for="category">分类</label>
          <select id="category" v-model="formData.group">
            <option value="">请选择分类</option>
            <option
              v-for="category in predefinedCategories"
              :key="category.value"
              :value="category.value"
            >
              {{ category.label }}
            </option>
          </select>
        </div>

        <div class="password-strength">
          <span>密码强度: </span>
          <div class="strength-indicator" :class="'strength-' + passwordStrength">
            <div class="strength-dots">
              <div
                v-for="i in 4"
                :key="i"
                class="dot"
                :class="{ active: isStrengthDotActive(i) }"
              ></div>
            </div>
            <span>{{ strengthText }}</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" type="button" @click="closeModal">取消</button>
        <button class="btn btn-primary" type="button" @click="savePassword">
          {{ isEditing ? '更新' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Icon from './Icon.vue'

// 添加 faviconData 获取相关方法
async function getFaviconData(url: string): Promise<string | null> {
  if (!url) return null

  try {
    // 首先检查是否已经有 faviconData
    const cachedFavicon = await window.api.password.getStoredFavicon(url)
    if (cachedFavicon) {
      return cachedFavicon
    }

    // 如果没有，尝试获取
    const favicon = await window.api.password.getWebsiteFavicon(url)
    if (favicon) {
      // 成功获取后，存储到数据库
      await window.api.password.saveWebsiteFavicon(url, favicon)
      return favicon
    }

    return null
  } catch (error) {
    console.error('获取网站favicon失败:', error)
    return null
  }
}

export default defineComponent({
  name: 'PasswordModal',
  components: {
    Icon
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    password: {
      type: Object,
      default: null
    },
    isEditing: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'save'],
  data() {
    return {
      formData: {
        title: '',
        username: '',
        password: '',
        url: '',
        category: '',
        group: '',
        favicon: ''
      },
      showPassword: false, // 控制密码可见性状态
      predefinedCategories: [
        { value: 'website', label: '网站' },
        { value: 'payment', label: '支付信息' },
        { value: 'wifi', label: 'Wi-Fi' },
        { value: 'app', label: '应用' },
        { value: 'other', label: '其他' }
      ]
    }
  },
  computed: {
    passwordStrength() {
      if (!this.formData.password) return 'weak'

      const password = this.formData.password
      let strength = 0

      // 长度检查
      if (password.length >= 8) strength++
      if (password.length >= 12) strength++

      // 复杂性检查
      if (/[A-Z]/.test(password)) strength++
      if (/[a-z]/.test(password)) strength++
      if (/[0-9]/.test(password)) strength++
      if (/[^A-Za-z0-9]/.test(password)) strength++

      if (strength <= 3) return 'weak'
      if (strength <= 5) return 'medium'
      return 'strong'
    },
    strengthText() {
      const strengthMap = {
        weak: '弱',
        medium: '中',
        strong: '强'
      }
      return strengthMap[this.passwordStrength]
    }
  },
  watch: {
    visible: {
      async handler(newVal) {
        if (newVal) {
          // 每次打开表单时，将密码可见性设置为隐藏状态（默认关闭）
          this.showPassword = false

          if (this.isEditing && this.password) {
            // 编辑模式：填充表单数据
            let password = this.password.password || ''

            // 如果是加密密码，则解密
            if (password && password.startsWith('{')) {
              try {
                password = await window.api.password.decryptPassword(this.password.password)
              } catch (error) {
                console.error('解密密码失败:', error)
                password = '解密失败'
              }
            }

            this.formData = {
              title: this.password.service || '',
              username: this.password.username || '',
              password: password,
              url: this.password.url || '',
              group: this.password.group || '',
              favicon: this.password.favicon || ''
            }
          } else {
            // 添加模式：重置表单
            this.resetForm()
          }
        } else {
          // 模态框关闭时重置状态
          this.showAllOptions = false
        }
      },
      immediate: true
    }
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    async savePassword() {
      // 验证必填字段
      if (!this.formData.title || !this.formData.username || !this.formData.password) {
        console.error('请填写所有必填字段')
        return
      }

      // 如果有网址但没有favicon，则尝试获取favicon
      if (this.formData.url && !this.formData.favicon) {
        try {
          this.formData.favicon =
            (await window.api.password.getWebsiteFavicon(this.formData.url)) || ''
        } catch (error) {
          console.error('获取网站图标失败:', error)
        }
      }

      // 准备保存的数据
      const passwordData = {
        service: this.formData.title,
        username: this.formData.username,
        password: this.formData.password,
        url: this.formData.url || '',
        group: this.formData.group,
        strength: this.passwordStrength,
        favicon: this.formData.favicon
      }

      // 获取并保存favicon
      if (this.formData.url) {
        getFaviconData(this.formData.url)
      }

      // 获取并保存favicon
      if (this.formData.url) {
        getFaviconData(this.formData.url)
      }

      // 获取并保存favicon
      if (this.formData.url) {
        getFaviconData(this.formData.url)
      }

      // 如果是编辑模式且有原始密码对象，包含ID
      if (this.isEditing && this.password) {
        // 发送ID和更新的数据，确保ID在对象顶层
        this.$emit('save', {
          ...passwordData,
          id: this.password.id
        })
      } else {
        // 添加新密码
        this.$emit('save', passwordData)
      }
    },
    resetForm() {
      this.formData = {
        title: '',
        username: '',
        password: '',
        url: '',
        group: '',
        favicon: ''
      }
    },
    generatePassword() {
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
      let password = ''
      for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      this.formData.password = password
    },
    isStrengthDotActive(index) {
      if (this.passwordStrength === 'weak') {
        return index === 1
      } else if (this.passwordStrength === 'medium') {
        return index <= 2
      } else {
        return index <= 4
      }
    },
    setIconAndColor() {
      const categoryIcons = {
        website: 'globe',
        payment: 'credit-card',
        wifi: 'network',
        app: 'mobile',
        other: 'key'
      }

      const categoryColors = {
        website: '#4361ee',
        payment: '#f72585',
        wifi: '#4cc9f0',
        app: '#3f37c9',
        other: '#6c757d'
      }

      this.formData.icon = categoryIcons[this.formData.group] || 'key'
      this.formData.color = categoryColors[this.formData.group] || '#4361ee'
    },
    // 处理分类输入
    handleCategoryInput() {
      // 用户输入时显示匹配的选项
      this.showAllOptions = false
    }
  }
})
</script>

<style scoped>
.password-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
}

.password-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-btn:hover {
  color: #333;
  background-color: #f5f5f5;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4361ee;
  box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1);
}

.password-input-group {
  display: flex;
  gap: 0.5rem;
}

.password-input-group input {
  flex: 1;
}

.password-input-group button {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.password-input-group button:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f8f9fa;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #e9ecef;
}

.btn-primary {
  background: #4361ee;
  color: white;
}

.btn-primary:hover {
  background: #3a56d4;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  font-size: 0.9rem;
}

.strength-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.strength-dots {
  display: flex;
  gap: 0.25rem;
}

.dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #ddd;
  transition: background 0.3s ease;
}

.dot.active {
  background: #f72585;
}

.strength-weak .dot:nth-child(1).active {
  background: #f72585;
}
</style>
