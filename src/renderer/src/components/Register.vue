<template>
  <div class="auth-container">
    <div class="auth-form card">
      <div class="logo">
        <Icon name="lock" :width="48" :height="48" />
        <h1>SPass</h1>
        <p>安全密码管理器</p>
      </div>

      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="registerForm.username"
            type="text"
            placeholder="请输入用户名"
            required
            spellcheck="false"
          />
          <div v-if="usernameError" class="field-error">
            {{ usernameError }}
          </div>
        </div>

        <div class="form-group">
          <label for="password">主密码</label>
          <div class="password-input-container">
            <input
              id="password"
              v-model="registerForm.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入主密码"
              required
              spellcheck="false"
            />
            <button type="button" class="toggle-password" @click="togglePasswordVisibility">
              <Icon :name="showPassword ? 'eye-off' : 'eye'" :width="24" :height="24" />
            </button>
          </div>
          <div class="password-hint">密码长度至少8位，建议包含大小写字母、数字和特殊字符</div>
        </div>

        <div class="form-group">
          <label for="confirmPassword">确认主密码</label>
          <div class="password-input-container">
            <input
              id="confirmPassword"
              v-model="registerForm.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="请再次输入主密码"
              required
              spellcheck="false"
            />
            <button type="button" class="toggle-password" @click="toggleConfirmPasswordVisibility">
              <Icon :name="showConfirmPassword ? 'eye-off' : 'eye'" :width="24" :height="24" />
            </button>
          </div>
        </div>

        <div class="form-group">
          <button type="button" class="btn btn-secondary" @click="generateStrongPassword">
            <Icon name="key" :width="24" :height="24" />
            生成强密码
          </button>
        </div>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>

        <div class="form-footer">
          <p>已有账户？<a href="#" @click.prevent="switchToLogin">立即登录</a></p>
        </div>
      </form>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from './Icon.vue'

// 注册表单数据接口
interface RegisterForm {
  username: string
  password: string
  confirmPassword: string
}

// 响应式数据
const registerForm = ref<RegisterForm>({
  username: '',
  password: '',
  confirmPassword: ''
})

const showPassword = ref(false)
const showConfirmPassword = ref(false)
const loading = ref(false)
const error = ref('')
const usernameError = ref('')

// 定义事件发射器
const emit = defineEmits<{
  (e: 'register-success'): void
  (e: 'switch-to-login'): void
}>()

// 监听用户名变化，清除错误信息
watch(
  () => registerForm.value.username,
  () => {
    usernameError.value = ''
  }
)

// 切换密码可见性
const togglePasswordVisibility = (): void => {
  showPassword.value = !showPassword.value
}

const toggleConfirmPasswordVisibility = (): void => {
  showConfirmPassword.value = !showConfirmPassword.value
}

// 生成强密码
const generateStrongPassword = (): void => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  let password = ''

  // 确保至少包含每种类型的字符
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  password += '0123456789'[Math.floor(Math.random() * 10)]
  password += '!@#$%^&*()_+-=[]{}|;:,.<>?'[Math.floor(Math.random() * 23)]

  // 剩余12位随机字符
  for (let i = 0; i < 12; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }

  // 打乱密码字符顺序
  password = password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('')

  registerForm.value.password = password
  registerForm.value.confirmPassword = password
}

// 验证表单
const validateForm = async (): Promise<boolean> => {
  // 检查用户名
  if (!registerForm.value.username) {
    error.value = '请输入用户名'
    return false
  }

  // 检查用户名是否已存在
  const exists = await window.api.user.userExists(registerForm.value.username)
  if (exists) {
    usernameError.value = '用户名已存在'
    error.value = '用户名已存在'
    return false
  }

  // 检查密码
  if (!registerForm.value.password) {
    error.value = '请输入主密码'
    return false
  }

  if (registerForm.value.password.length < 8) {
    error.value = '密码长度至少8位'
    return false
  }

  // 检查确认密码
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    error.value = '两次输入的密码不一致'
    return false
  }

  return true
}

// 处理注册
const handleRegister = async (): Promise<void> => {
  error.value = ''
  usernameError.value = ''

  const isValid = await validateForm()
  if (!isValid) {
    return
  }

  loading.value = true

  try {
    // 调用API注册用户
    await window.api.user.registerUser(registerForm.value.username, registerForm.value.password)

    // 注册成功，触发事件
    emit('register-success')
  } catch (err) {
    // 处理注册错误
    error.value = '注册时发生错误，请稍后重试'
    console.error('Register error:', err)
  } finally {
    // 重置加载状态
    loading.value = false
  }
}

// 切换到登录页面
const switchToLogin = (): void => {
  emit('switch-to-login')
}
</script>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-form {
  padding: 40px;
  width: 100%;
  max-width: 400px;
}

.logo {
  text-align: center;
  margin-bottom: 30px;
}

.logo h1 {
  margin: 15px 0 5px;
  color: #333;
  font-size: 28px;
}

.logo p {
  color: #666;
  margin: 0;
}

.password-input-container {
  position: relative;
}

.password-input-container input {
  padding-right: 40px;
}

.toggle-password {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
}

.password-hint {
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

.form-footer {
  text-align: center;
  margin-top: 20px;
}

.form-footer a {
  color: #667eea;
  text-decoration: none;
}

.form-footer a:hover {
  text-decoration: underline;
}

.field-error {
  margin-top: 5px;
  font-size: 12px;
  color: #c62828;
}
</style>
