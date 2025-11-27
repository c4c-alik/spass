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
  getWebsiteFavicon: (url: string) => Promise<string | null>
}

// 定义 UserAPI 接口
interface UserAPI {
  registerUser: (username: string, password: string) => Promise<number | undefined>
  validateUser: (username: string, password: string) => Promise<boolean>
  userExists: (username: string) => Promise<boolean>
  logoutUser: () => Promise<void>
  updateAutoLockTime: (time: number) => Promise<void>
}

// 定义 SecurityAPI 接口
interface SecurityAPI {
  lockApplication: () => Promise<boolean>
  isApplicationLocked: () => Promise<boolean>
}

// 定义 ElectronAPI 接口
interface ElectronAPI {
  onAppLocked: (callback: () => void) => void
  removeAppLockedListener: (callback: () => void) => void
}

// 定义整体 API 接口
interface API {
  password: PasswordAPI
  user: UserAPI
  security: SecurityAPI
  electronAPI: ElectronAPI
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
      ipcRenderer.invoke('import-from-kdbx', fileData, masterPassword),
    getWebsiteFavicon: (url: string): Promise<string | null> =>
      ipcRenderer.invoke('get-website-favicon', url)
  },
  user: {
    registerUser: (username: string, password: string): Promise<number | undefined> =>
      ipcRenderer.invoke('register-user', username, password),
    validateUser: (username: string, password: string): Promise<boolean> =>
      ipcRenderer.invoke('validate-user', username, password),
    userExists: (username: string): Promise<boolean> => ipcRenderer.invoke('user-exists', username),
    logoutUser: (): Promise<void> => ipcRenderer.invoke('logout-user'),
    updateAutoLockTime: (time: number): Promise<void> => ipcRenderer.invoke('update-auto-lock-time', time)
  },
  security: {
    lockApplication: (): Promise<boolean> => ipcRenderer.invoke('lock-application'),
    isApplicationLocked: (): Promise<boolean> => ipcRenderer.invoke('is-application-locked')
  }
} as API)

// 暴露 Electron API
contextBridge.exposeInMainWorld('electronAPI', {
  onAppLocked: (callback: () => void): void => {
    ipcRenderer.on('app-locked', callback)
  },
  removeAppLockedListener: (callback: () => void): void => {
    ipcRenderer.removeListener('app-locked', callback)
  }
} as ElectronAPI)