<template>
  <div class="modal-overlay" :class="{ visible: visible }" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <div class="modal-title">导出密码</div>
        <button class="modal-close" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="exportScope">导出范围</label>
          <select id="exportScope" v-model="exportScope">
            <option value="all">所有密码</option>
            <option value="current">当前分类</option>
          </select>
        </div>

        <div class="form-group">
          <label for="exportPassword">加密密码 (可选)</label>
          <input
            id="exportPassword"
            v-model="exportPassword"
            type="password"
            placeholder="为导出文件设置密码"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn secondary" @click="closeModal">取消</button>
        <button class="modal-btn primary" @click="startExport">开始导出</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  passwords: any[]
  filteredPasswords: any[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'export-success'): void
}>()

// 导出相关状态
const exportScope = ref('all')
const exportPassword = ref('')

// 监听visible变化，重置状态
watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      // 模态框关闭时重置状态
      exportScope.value = 'all'
      exportPassword.value = ''
    }
  }
)

const closeModal = () => {
  emit('close')
}

const startExport = async () => {
  try {
    // 根据导出范围过滤密码
    let passwordsToExport = props.passwords
    if (exportScope.value === 'current') {
      passwordsToExport = props.filteredPasswords
    }

    // 将密码数据转换为可序列化的格式
    const serializablePasswords = passwordsToExport.map((password) => ({
      service: password.service,
      username: password.username,
      password: password.password,
      url: password.url || '',
      notes: password.notes || '',
      category: password.category || 'other'
    }))


    console.log('导出密码数据:', serializablePasswords)
    // 通过主进程创建KDBX数据库
    const kdbx = await window.api.password.exportToKdbx(serializablePasswords, exportPassword.value)

    // 创建并下载文件
    const blob = new Blob([kdbx], { type: 'application/x-kdbx' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spass-export-${new Date().toISOString().slice(0, 10)}.kdbx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    closeModal()
    emit('export-success')
  } catch (error) {
    console.error('导出失败:', error)
    // 错误信息将仅在控制台中显示
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
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-overlay.visible {
  display: flex;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--gray);
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
  color: var(--dark);
}

.form-group select,
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--dark);
  background: white;
}

.form-group select:focus,
.form-group input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.2);
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
}

.modal-btn.primary {
  background: var(--primary);
  color: white;
  border: none;
}

.modal-btn.primary:hover {
  background: var(--secondary);
}

.modal-btn.secondary {
  background: var(--light);
  color: #4b5563;
  border: 1px solid var(--border);
}

.modal-btn.secondary:hover {
  background: #e5e7eb;
}
</style>
