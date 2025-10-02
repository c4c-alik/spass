<template>
  <div class="modal-overlay" :class="{ visible: visible }" @click="closeModal">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <div class="modal-title">导入密码</div>
        <button class="modal-close" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <div
          class="file-drop"
          :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="onDragOver"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop"
          @click="triggerFileSelect"
        >
          <Icon name="cloud-upload" :width="32" :height="32" />
          <p>拖放文件到此处或点击上传</p>
          <div class="file-types">支持格式: KDBX</div>
        </div>

        <div class="form-group">
          <label for="importStrategy">导入策略</label>
          <select id="importStrategy" v-model="importStrategy">
            <option value="merge">合并 - 保留现有项目，添加新项目</option>
            <option value="replace">替换 - 删除所有现有项目后导入</option>
          </select>
        </div>

        <div class="form-group">
          <label for="importPassword">数据库密码</label>
          <input
            id="importPassword"
            v-model="importPassword"
            type="password"
            placeholder="请输入KDBX数据库密码"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn secondary" @click="closeModal">取消</button>
        <button class="modal-btn primary" :disabled="!selectedFile" @click="startImport">
          开始导入
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'import-success'): void
}>()

// 导入相关状态
const selectedFile = ref<File | null>(null)
const importStrategy = ref('merge')
const importPassword = ref('')
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// 监听visible变化，重置状态
watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      // 模态框关闭时重置状态
      selectedFile.value = null
      importStrategy.value = 'merge'
      importPassword.value = ''
    }
  }
)

const closeModal = () => {
  emit('close')
}

const triggerFileSelect = () => {
  // 创建临时的文件输入元素
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.kdbx'
  input.style.display = 'none'
  input.onchange = (event) => {
    const target = event.target as HTMLInputElement
    if (target.files && target.files.length > 0) {
      selectedFile.value = target.files[0]
    }
  }
  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const onDragOver = () => {
  isDragOver.value = true
}

const onDragLeave = () => {
  isDragOver.value = false
}

const onDrop = (event: DragEvent) => {
  isDragOver.value = false
  if (event.dataTransfer && event.dataTransfer.files.length > 0) {
    selectedFile.value = event.dataTransfer.files[0]
  }
}

const startImport = async () => {
  if (!selectedFile.value) {
    alert('请选择一个文件')
    return
  }

  try {
    // 读取文件内容
    const arrayBuffer = await readFileContent(selectedFile.value)

    // 通过主进程解析KDBX文件
    const importedPasswords = await window.api.password.importFromKdbx(
      arrayBuffer,
      importPassword.value
    )

    // 根据导入策略处理密码数据

    // 如果策略是替换，则先清空现有数据
    if (importStrategy.value === 'replace') {
      // 获取当前所有密码
      const currentPasswords = await window.api.password.getAllPasswords()
      // 删除所有现有密码
      for (const password of currentPasswords) {
        await window.api.password.deletePassword(password.id)
      }
    }

    // 添加导入的密码到数据库
    let importedCount = 0
    for (const password of importedPasswords) {
      try {
        // 检查密码是否是加密格式，如果是则需要解密
        let decryptedPassword = password.password
        try {
          // 尝试解析密码是否为加密格式
          const encryptedData = JSON.parse(password.password)
          if (encryptedData.encrypted && encryptedData.iv && encryptedData.authTag) {
            // 如果是加密格式，请求主进程解密
            decryptedPassword = await window.api.password.decryptPassword(password.password)
          }
        } catch (e) {
          // 如果解析失败，说明密码是明文格式，不需要解密
        }

        // 使用解密后的密码创建新对象
        const passwordToAdd = {
          ...password,
          password: decryptedPassword
        }

        await window.api.password.addPassword(passwordToAdd)
        importedCount++
      } catch (addError) {
        console.error('添加密码失败:', addError)
      }
    }

    closeModal()
    emit('import-success')
    alert(`成功导入 ${importedCount} 条密码记录!`)
  } catch (error) {
    console.error('导入失败:', error)
    alert('导入失败: ' + (error as Error).message)
  }
}

// 读取文件内容
const readFileContent = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
    reader.onerror = (e) => reject(new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
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

.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--dark);
  background: white;
}

.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.2);
}

.file-drop {
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s;
  margin-bottom: 20px;
  background-color: var(--light);
}

.file-drop:hover,
.file-drop.drag-over {
  border-color: var(--primary);
  background-color: rgba(67, 97, 238, 0.05);
}

.file-drop svg {
  font-size: 32px;
  color: var(--gray);
  margin-bottom: 10px;
}

.file-drop p {
  color: var(--gray);
  margin-bottom: 5px;
}

.file-drop .file-types {
  font-size: 12px;
  color: #9ca3af;
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

.modal-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
