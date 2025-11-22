<template>
  <div class="auth-container" :class="{ 'lock-screen': isLockScreen }">
    <div class="auth-form card">
      <div class="logo" v-if="!isLockScreen">
        <Icon name="lock" :width="48" :height="48" />
        <h1>SPass</h1>
        <p>安全密码管理器</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username" v-if="!isLockScreen">用户名</label>
          <input
            id="username"
            type="text"
            v-model="loginForm.username"
            :placeholder="isLockScreen ? '请输入用户名' : '请输入用户名'"
            :disabled="isLockScreen"
            required
          />
        </div>

        <div class="form-group">
          <label for="password">主密码</label>
          <input
            id="password"
            type="password"
            v-model="loginForm.password"
            placeholder="请输入主密码"
            required
            ref="passwordInput"
          />
        </div>

        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? '登录中...' : (isLockScreen ? '解锁' : '登录') }}
        </button>

        <div class="form-footer" v-if="!isLockScreen">
          <p>还没有账户？<a href="#" @click.prevent="switchToRegister">立即注册</a></p>
        </div>
      </form>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'

// 登录表单数据接口
interface LoginForm {
  username: string
  password: string
}

const props = defineProps<{
  isLockScreen?: boolean
}>()

// 响应式数据
const loginForm = ref<LoginForm>({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')
const passwordInput = ref<HTMLInputElement | null>(null)

// 定义事件发射器
const emit = defineEmits<{
  (e: 'login-success', username: string): void
  (e: 'switch-to-register'): void
}>()

// 监听锁屏状态变化
watch(() => props.isLockScreen, (isLockScreen) => {
  if (isLockScreen) {
    // 如果是锁屏状态，从本地存储获取用户名
    const savedUsername = localStorage.getItem('spass-username')
    if (savedUsername) {
      loginForm.value.username = savedUsername
    }

    // 聚焦到密码输入框
    nextTick(() => {
      if (passwordInput.value) {
        passwordInput.value.focus()
      }
    })
  }
}, { immediate: true })

// 处理登录逻辑
const handleLogin = async (): Promise<void> => {
  // 表单验证
  if (!loginForm.value.username || !loginForm.value.password) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    // 调用API验证用户
    const isValid = await window.api.user.validateUser(
      loginForm.value.username,
      loginForm.value.password
    )

    if (isValid) {
      // 登录成功，触发事件并传递用户名
      if (!props.isLockScreen) {
        localStorage.setItem('spass-username', loginForm.value.username)
      }
      emit('login-success', loginForm.value.username)
    } else {
      // 登录失败，显示错误信息
      error.value = '用户名或密码错误'
      // 聚焦到密码输入框以便重新输入
      if (passwordInput.value) {
        passwordInput.value.focus()
      }
    }
  } catch (err) {
    // 处理登录错误
    error.value = '登录时发生错误，请稍后重试'
    console.error('Login error:', err)
  } finally {
    // 重置加载状态
    loading.value = false
  }
}

// 切换到注册页面
const switchToRegister = (): void => {
  emit('switch-to-register')
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

.auth-container.lock-screen {
  background: transparent;
  min-height: auto;
  padding: 0;
}

.auth-form {
  padding: 40px;
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.auth-container.lock-screen .auth-form {
  padding: 0;
  background: transparent;
  box-shadow: none;
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

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-group input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-footer {
  text-align: center;
  margin-top: 20px;
}

.form-footer a {
  color: #2563eb;
  text-decoration: none;
}

.form-footer a:hover {
  text-decoration: underline;
}

.error-message {
  margin-top: 15px;
  padding: 12px;
  background-color: #fee2e2;
  color: #b91c1c;
  border-radius: 8px;
  text-align: center;
}
</style>
