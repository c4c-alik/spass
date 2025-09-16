<template>
  <div class="modal-overlay" v-if="visible" @click.self="closeModal">
    <div class="password-modal">
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
              <Icon :name="showPassword ? 'eye-off' : 'eye'" :width="20" :height="20" />
            </button>
            <button class="generate-password" @click="generatePassword" type="button">
              <Icon name="dice" :width="20" :height="20" />
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
            @focus="showAllOptions = true"
            @blur="showAllOptions = false"
          >
            <option value="">选择或输入分类</option>
            <option 
              v-for="category in (showAllOptions ? allCategories : filteredCategories)" 
              :key="category.value" 
              :value="category.value"
            >
              {{ category.label }}
            </option>
          </select>
          <!-- 隐藏输入框用于捕获用户输入 -->
          <input
            type="text"
            class="hidden-category-input"
            v-model="formData.category"
            placeholder="输入自定义分类"
            @input="handleCategoryInput"
          />
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
      showAllOptions: false, // 控制是否显示所有选项
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
    },
    // 根据用户输入过滤分类选项
    filteredCategories() {
      if (!this.formData.category) {
        return this.predefinedCategories
      }
      
      // 查找匹配的预定义分类
      const matchedCategories = this.predefinedCategories.filter(category => 
        category.label.includes(this.formData.category) || 
        category.value.includes(this.formData.category)
      )
      
      // 如果输入的不是预定义分类，则添加为新分类
      if (!this.predefinedCategories.some(c => c.value === this.formData.category)) {
        return [
          { value: this.formData.category, label: `新增: ${this.formData.category}` },
          ...matchedCategories
        ]
      }
      
      return matchedCategories
    },
    // 所有分类（包括预定义和用户输入的）
    allCategories() {
      // 如果当前输入不是预定义分类，则添加到列表顶部
      if (this.formData.category && !this.predefinedCategories.some(c => c.value === this.formData.category)) {
        return [
          { value: this.formData.category, label: `新增: ${this.formData.category}` },
          ...this.predefinedCategories
        ]
      }
      return this.predefinedCategories
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

      // 确保分类有默认值
      if (!this.formData.category) {
        this.formData.category = 'other'
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
}

.password-modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4361ee;
}

/* 可编辑下拉框样式 */
.form-group select {
  appearance: none; /* 移除默认箭头 */
  padding-right: 40px;
  cursor: pointer;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
}

/* 隐藏的分类输入框 */
.hidden-category-input {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(100% - 40px);
  height: 100%;
  padding: 12px;
  border: none;
  background: transparent;
  font-size: 1rem;
  pointer-events: none; /* 默认不响应事件 */
  z-index: 1;
}

.form-group:focus-within .hidden-category-input {
  pointer-events: auto; /* 获得焦点时响应事件 */
}

.password-input-group {
  display: flex;
  gap: 10px;
}

.password-input-group input {
  flex: 1;
}

.password-input-group button {
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.password-input-group button:hover {
  background: #e0e0e0;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn-primary {
  background: #4361ee;
  color: white;
}

.btn-primary:hover {
  background: #3a56e0;
}

.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.strength-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
}

.strength-dots {
  display: flex;
  gap: 3px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ddd;
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
</style>