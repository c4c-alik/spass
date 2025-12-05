<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import PasswordManager from './components/PasswordManager.vue'
import Login from './components/Login.vue'
import Register from './components/Register.vue'

// 认证状态
const isAuthenticated = ref(false)
const isLocked = ref(false)
const authView = ref('login') // 'login' or 'register'
const currentUsername = ref('')

// 处理登录成功事件
const handleLoginSuccess = (username: string): void => {
  isAuthenticated.value = true
  isLocked.value = false
  currentUsername.value = username
}

// 处理注册成功事件
const handleRegisterSuccess = (): void => {
  authView.value = 'login'
}

// 切换到注册视图
const switchToRegister = (): void => {
  authView.value = 'register'
}

// 切换到登录视图
const switchToLogin = (): void => {
  authView.value = 'login'
}

// 监听退出事件
const handleLogout = (): void => {
  isAuthenticated.value = false
  isLocked.value = false
  currentUsername.value = ''
}

// 监听锁定事件
const handleLock = (): void => {
  isLocked.value = true
}

// 监听解锁事件
const handleUnlock = (): void => {
  isLocked.value = false
}

onMounted(() => {
  window.addEventListener('logout', handleLogout)
  window.addEventListener('lock', handleLock)
  window.addEventListener('unlock', handleUnlock)
})

onBeforeUnmount(() => {
  window.removeEventListener('logout', handleLogout)
  window.removeEventListener('lock', handleLock)
  window.removeEventListener('unlock', handleUnlock)
})
</script>

<template>
  <div id="app">
    <template v-if="isAuthenticated && !isLocked">
      <PasswordManager :username="currentUsername" />
    </template>
    <template v-else-if="isLocked">
      <div class="lock-screen">
        <div class="lock-content">
          <div class="lock-icon">
            <Icon name="lock" :width="64" :height="64" />
          </div>
          <h2>应用已锁定</h2>
          <p class="lock-message">请输入主密码以解锁您的密码库</p>
          <div class="lock-form">
            <Login
              :is-lock-screen="true"
              @login-success="handleUnlock"
              @switch-to-register="switchToRegister"
            />
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <Login
        v-if="authView === 'login'"
        @login-success="handleLoginSuccess"
        @switch-to-register="switchToRegister"
      />
      <Register v-else @register-success="handleRegisterSuccess" @switch-to-login="switchToLogin" />
    </template>
  </div>
</template>

<style>
#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  will-change: transform;
}

.lock-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}

.lock-content {
  background: rgba(255, 255, 255, 0.95);
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
  width: 100%;
  max-width: 450px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.lock-icon {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.lock-content h2 {
  margin: 0 0 10px;
  color: #1e293b;
  font-size: 28px;
  font-weight: 700;
}

.lock-message {
  color: #64748b;
  margin-bottom: 30px;
  font-size: 16px;
}

.lock-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50%;
  max-width: 400px;
  margin: 0 auto;
}
</style>
