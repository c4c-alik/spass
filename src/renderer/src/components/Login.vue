<template>
  <div class="auth-container">
    <div class="auth-form card">
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
        
        <button type="submit" class="btn btn-primary" :disabled="loading">
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

// 登录表单数据接口
interface LoginForm {
  username: string
  password: string
}

// 响应式数据
const loginForm = ref<LoginForm>({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')

// 定义事件发射器
const emit = defineEmits<{
  (e: 'login-success', username: string): void
  (e: 'switch-to-register'): void
}>()

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
      emit('login-success', loginForm.value.username)
    } else {
      // 登录失败，显示错误信息
      error.value = '用户名或密码错误'
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
</style>