<template>
  <div class="modal-overlay" v-if="visible" @click.self="closeModal">
    <div class="password-modal">
      <div class="modal-header">
        <h2>{{ isEditing ? '编辑密码' : '添加新密码' }}</h2>
        <button class="close-btn" @click="closeModal">
          <i class="fas fa-times"></i>
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
          >
        </div>

        <div class="form-group">
          <label for="username">用户名/邮箱</label>
          <input
            type="text"
            id="username"
            v-model="formData.username"
            placeholder="输入用户名或邮箱"
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
            >
            <button class="toggle-password" @click="showPassword = !showPassword">
              <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
            <button class="generate-password" @click="generatePassword">
              <i class="fas fa-dice"></i>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="website">网站地址 (可选)</label>
          <input
            type="url"
            id="website"
            v-model="formData.website"
            placeholder="https://"
          >
        </div>

        <div class="form-group">
          <label for="category">分类</label>
          <select id="category" v-model="formData.category">
            <option value="website">网站</option>
            <option value="payment">支付信息</option>
            <option value="wifi">Wi-Fi</option>
            <option value="app">应用</option>
            <option value="other">其他</option>
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
        <button class="btn btn-secondary" @click="closeModal">取消</button>
        <button class="btn btn-primary" @click="savePassword">{{ isEditing ? '更新' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PasswordModal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    editingPassword: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      formData: {
        id: null,
        title: '',
        username: '',
        password: '',
        website: '',
        category: 'website',
        strength: 'weak',
        isFavorited: false,
        icon: 'fas fa-key',
        color: '#4361ee'
      },
      showPassword: false
    }
  },
  computed: {
    isEditing() {
      return !!this.editingPassword
    },
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
        if (this.editingPassword) {
          // 编辑模式：填充表单数据
          this.formData = { ...this.editingPassword }
        } else {
          // 添加模式：重置表单
          this.resetForm()
        }
      }
    }
  },
  methods: {
    closeModal() {
      this.$emit('close')
    },
    savePassword() {
      // 更新密码强度
      this.formData.strength = this.passwordStrength

      // 设置图标和颜色基于分类
      this.setIconAndColor()

      if (this.isEditing) {
        this.$emit('update', { ...this.formData })
      } else {
        // 生成唯一ID（在实际应用中应由后端生成）
        this.formData.id = Date.now().toString()
        this.$emit('create', { ...this.formData })
      }

      this.closeModal()
    },
    resetForm() {
      this.formData = {
        id: null,
        title: '',
        username: '',
        password: '',
        website: '',
        category: 'website',
        strength: 'weak',
        isFavorited: false,
        icon: 'fas fa-key',
        color: '#4361ee'
      }
    },
    generatePassword() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()'
      let password = ''

      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      this.formData.password = password
    },
    setIconAndColor() {
      const categoryConfig = {
        'website': { icon: 'fas fa-globe', color: '#4361ee' },
        'payment': { icon: 'fas fa-credit-card', color: '#f72585' },
        'wifi': { icon: 'fas fa-wifi', color: '#4cc9f0' },
        'app': { icon: 'fas fa-mobile-alt', color: '#3f37c9' },
        'other': { icon: 'fas fa-key', color: '#6c757d' }
      }

      const config = categoryConfig[this.formData.category] || categoryConfig.other
      this.formData.icon = config.icon
      this.formData.color = config.color
    },
    isStrengthDotActive(index) {
      const activeDotsMap = {
        'weak': 1,
        'medium': 2,
        'strong': 4
      }
      return index <= activeDotsMap[this.passwordStrength]
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}

.password-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #dee2e6;
}

.modal-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #212529;
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  color: #6c757d;
  cursor: pointer;
  padding: 5px;
}

.close-btn:hover {
  color: #212529;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #212529;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4361ee;
}

.password-input-group {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-group input {
  padding-right: 80px;
}

.toggle-password,
.generate-password {
  position: absolute;
  right: 40px;
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 5px;
}

.generate-password {
  right: 10px;
}

.toggle-password:hover,
.generate-password:hover {
  color: #4361ee;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.strength-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strength-dots {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #dee2e6;
}

.dot.active {
  background: #4cc9f0;
}

.strength-weak .dot.active {
  background: #f72585;
}

.strength-medium .dot:nth-child(-n+2).active {
  background: orange;
}

.strength-strong .dot.active {
  background: #4cc9f0;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-secondary {
  background: #f8f9fa;
  color: #212529;
}

.btn-secondary:hover {
  background: #e9ecef;
}

.btn-primary {
  background: #4361ee;
  color: white;
}

.btn-primary:hover {
  background: #3f37c9;
}
</style>
