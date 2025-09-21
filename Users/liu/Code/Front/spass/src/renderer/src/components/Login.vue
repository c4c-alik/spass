<template>
  <div class="auth-container">
    <div class="auth-form">
      <div class="logo">
        <Icon name="lock" :width="48" :height="48" />
        <h1>SPass</h1>
        <p>安全密码管理器</p>
      </div>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            type="text"
            v-model="loginForm.username"
            placeholder="请输入用户名"
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
          />
        </div>
        
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        
        <div class="form-footer">
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
import { ref } from 'vue'
import Icon from './Icon.vue'

interface LoginForm {
  username: string
  password: string
}

const loginForm = ref<LoginForm>({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')

const emit = defineEmits<{
  (e: 'login-success'): void
  (e: 'switch-to-register'): void
}>()

const handleLogin = async (): Promise<void> => {
  if (!loginForm.value.username || !loginForm.value.password) {
    error.value = '请输入用户名和密码'
    return
  }
  
  loading.value = true
  error.value = ''
  
  try {
    const isValid = await window.api.user.validateUser(
      loginForm.value.username,
      loginForm.value.password
    )
    
    if (isValid) {
      emit('login-success')
    } else {
      error.value = '用户名或密码错误'
    }
  } catch (err) {
    error.value = '登录时发生错误，请稍后重试'
    console.error('Login error:', err)
  } finally {
    loading.value = false
  }
}

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

.auth-form {
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
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
  border-radius: 5px;
  font-size: 16px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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

.error-message {
  margin-top: 15px;
  padding: 10px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 5px;
  text-align: center;
  font-size: 14px;
}
</style>