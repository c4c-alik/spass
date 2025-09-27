import { contextBridge, ipcRenderer } from 'electron'
import { PasswordEntry } from '../database'

// 定义 PasswordAPI 接口
interface PasswordAPI {
  getAllPasswords: () => Promise<PasswordEntry[]>
  addPassword: (password: PasswordEntry) => Promise<number | undefined>
  updatePassword: (id: number, password: PasswordEntry) => Promise<number>
  deletePassword: (id: number) => Promise<number>
  searchPasswords: (query: string) => Promise<PasswordEntry[]>
  decryptPassword: (encryptedPassword: string) => Promise<string>
  toggleFavorite: (id: number) => Promise<void>
  exportToKdbx: (passwords: any[], masterPassword: string) => Promise<ArrayBuffer>
  importFromKdbx: (fileData: ArrayBuffer, masterPassword: string) => Promise<any[]>
}

// 定义 UserAPI 接口
interface UserAPI {
  registerUser: (username: string, password: string) => Promise<number | undefined>
  validateUser: (username: string, password: string) => Promise<boolean>
  userExists: (username: string) => Promise<boolean>
}

// 定义 SecurityAPI 接口
interface SecurityAPI {
  lockApplication: () => Promise<boolean>
  isApplicationLocked: () => Promise<boolean>
}

// 定义整体 API 接口
interface API {
  password: PasswordAPI
  user: UserAPI
  security: SecurityAPI
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('api', {
  password: {
    getAllPasswords: (): Promise<PasswordEntry[]> => ipcRenderer.invoke('get-passwords'),
    addPassword: (password: PasswordEntry): Promise<number | undefined> =>
      ipcRenderer.invoke('add-password', password),
    updatePassword: (id: number, password: PasswordEntry): Promise<number> =>
      ipcRenderer.invoke('update-password', { id, passwordData: password }),
    deletePassword: (id: number): Promise<number> => ipcRenderer.invoke('delete-password', id),
    searchPasswords: (query: string): Promise<PasswordEntry[]> =>
      ipcRenderer.invoke('search-passwords', query),
    decryptPassword: (encryptedPassword: string): Promise<string> =>
      ipcRenderer.invoke('decrypt-password', encryptedPassword),
    toggleFavorite: (id: number): Promise<void> => ipcRenderer.invoke('toggle-favorite', id),
    exportToKdbx: (passwords: any[], masterPassword: string): Promise<ArrayBuffer> =>
      ipcRenderer.invoke('export-to-kdbx', passwords, masterPassword),
    importFromKdbx: (fileData: ArrayBuffer, masterPassword: string): Promise<any[]> =>
      ipcRenderer.invoke('import-from-kdbx', fileData, masterPassword)
  },
  user: {
    registerUser: (username: string, password: string): Promise<number | undefined> =>
      ipcRenderer.invoke('register-user', username, password),
    validateUser: (username: string, password: string): Promise<boolean> =>
      ipcRenderer.invoke('validate-user', username, password),
    userExists: (username: string): Promise<boolean> => ipcRenderer.invoke('user-exists', username)
  },
  security: {
    lockApplication: (): Promise<boolean> => ipcRenderer.invoke('lock-application'),
    isApplicationLocked: (): Promise<boolean> => ipcRenderer.invoke('is-application-locked')
  }
} as API)
