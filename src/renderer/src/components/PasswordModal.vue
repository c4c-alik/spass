<template>
  <div class="modal-overlay" v-if="visible" @click.self="closeModal">
    <div class="password-modal card">
      <div class="modal-header">
        <h2>{{ isEditing ? '编辑密码' : '添加新密码' }}</h2>
        <button class="close-btn" @click="closeModal" type="button">
          <Icon name="x" :width="24" :height="24" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="title">服务名称</label>
          <input
            type="text"
            id="title"
            v-model="formData.title"
            placeholder="例如：Google、Facebook"
            required
          >
        </div>

        <div class="form-group">
          <label for="username">用户名/邮箱</label>
          <input
            type="text"
            id="username"
            v-model="formData.username"
            placeholder="输入用户名或邮箱"
            required
          >
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <div class="password-input-group">
            <input
              :type="showPassword ? 'text' : 'password'"
              id="password"
              v-model="formData.password"
              placeholder="输入密码"
              required
            >
            <button class="toggle-password" @click="showPassword = !showPassword" type="button">
              <Icon :name="showPassword ? 'eye-off' : 'eye'" :width="24" :height="24" />
            </button>
            <button class="generate-password" @click="generatePassword" type="button">
              <Icon name="dice" :width="24" :height="24" />
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="url">网站地址 (可选)</label>
          <input
            type="url"
            id="url"
            v-model="formData.url"
            placeholder="https://"
          >
        </div>

        <div class="form-group">
          <label for="category">分类</label>
          <select
            id="category"
            v-model="formData.category"
          >
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
              <div v-for="i in 4" :key="i" class="dot" :class="{ active: isStrengthDotActive(i) }"></div>
            </div>
            <span>{{ strengthText }}</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="closeModal" type="button">取消</button>
        <button class="btn btn-primary" @click="savePassword" type="button">{{ isEditing ? '更新' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Icon from './Icon.vue'

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
        category: ''
      },
      showPassword: false,
      predefinedCategories: [ // 预定义的分类
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
        'weak': '弱',
        'medium': '中',
        'strong': '强'
      }
      return strengthMap[this.passwordStrength]
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        if (this.isEditing && this.password) {
          // 编辑模式：填充表单数据
          this.formData = {
            title: this.password.service || '',
            username: this.password.username || '',
            password: this.password.password || '',
            url: this.password.url || '',
            category: this.password.category || ''
          }
        } else {
          // 添加模式：重置表单
          this.resetForm()
        }
      } else {
        // 模态框关闭时重置状态
        this.showAllOptions = false
      }
    }
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    savePassword() {
      // 验证必填字段
      if (!this.formData.title || !this.formData.username || !this.formData.password) {
        console.error('请填写所有必填字段')
        return
      }

      // 准备保存的数据
      const passwordData = {
        service: this.formData.title,
        username: this.formData.username,
        password: this.formData.password,
        url: this.formData.url || '',
        category: this.formData.category,
        strength: this.passwordStrength
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
        category: ''
      }
    },
    generatePassword() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
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
        'website': 'globe',
        'payment': 'credit-card',
        'wifi': 'network',
        'app': 'mobile',
        'other': 'key'
      }

      const categoryColors = {
        'website': '#4361ee',
        'payment': '#f72585',
        'wifi': '#4cc9f0',
        'app': '#3f37c9',
        'other': '#6c757d'
      }

      this.formData.icon = categoryIcons[this.formData.category] || 'key'
      this.formData.color = categoryColors[this.formData.category] || '#4361ee'
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
.modal-overlay {
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


.password-input-group {
  display: flex;
  gap: 0.5rem;
}

.password-input-group input {
  flex: 1;
}


.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  flex-shrink: 0;
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

.strength-medium .dot:nth-child(1).active,
.strength-medium .dot:nth-child(2).active {
  background: #f7b924;
}

.strength-strong .dot.active {
  background: #4cc9f0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0.5rem;
    align-items: stretch;
  }
  
  .password-modal {
    max-height: 100vh;
    border-radius: 0;
  }
  
  .modal-header {
    padding: 1rem;
  }
  
  .modal-body {
    padding: 1rem;
  }
  
  .modal-footer {
    padding: 1rem;
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
    padding: 0.75rem;
    font-size: 0.9rem;
  }
  
  .password-input-group {
    flex-direction: column;
  }
  
  .password-input-group button {
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    font-size: 0.875rem;
  }
  
  .form-group input,
  .form-group select {
    font-size: 0.875rem;
    padding: 0.625rem;
  }
  
  .password-strength {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>
