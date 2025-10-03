<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PasswordManager from './components/PasswordManager.vue'
import Login from './components/Login.vue'
import Register from './components/Register.vue'

// 认证状态
const isAuthenticated = ref(false)
const authView = ref('login') // 'login' or 'register'

// 处理登录成功事件
const handleLoginSuccess = (): void => {
  isAuthenticated.value = true
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
onMounted(() => {
  window.addEventListener('logout', () => {
    isAuthenticated.value = false
  })
})
</script>

<template>
  <div id="app">
    <template v-if="isAuthenticated">
      <PasswordManager />
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
</style>