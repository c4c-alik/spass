import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { AuthCenter } from '../database/auth/authCenter'
import { encryptionManager } from '../utils/encryption'
import { globalMemoryDatabase } from '../database/memoryDatabase'
import { PasswordsTable } from '../database/tables/passwordsTable'
import { FaviconsTable } from '../database/tables/faviconsTable'
import fetch from 'node-fetch'

// 设置应用区域和语言
app.commandLine.appendSwitch('lang', 'zh-CN')
app.commandLine.appendSwitch('locale', 'zh-CN')

let autoLockTimeout: NodeJS.Timeout | null = null
let autoLockTime = 30 * 60 * 1000 // 默认30分钟
let mainWindow: BrowserWindow | null = null
const userDbPath = join(app.getPath('userData'), 'users.db')

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 认证中心初始化
  await AuthCenter.initialize(userDbPath)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // 监听锁定事件
  ipcMain.on('app-locked', () => {
    if (mainWindow) {
      mainWindow.webContents.send('app-locked')
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出前关闭数据库连接
app.on('before-quit', async (event) => {
  // 阻止默认的退出行为，直到我们完成数据保存
  event.preventDefault()

  try {
    // 在退出前保存内存数据库到加密文件
    await saveMemoryDbToEncryptedFile()
    await globalMemoryDatabase.close()
  } catch (error) {
    console.error('Error during app quit:', error)
  } finally {
    // 强制退出应用
    app.exit(0)
  }
})

// 保存内存数据库到加密文件
async function saveMemoryDbToEncryptedFile(): Promise<void> {
  if (encryptionManager.isUnlocked()) {
    try {
      const dbBuffer = await globalMemoryDatabase.exportToBuffer()
      await encryptionManager.saveEncryptedDatabase(dbBuffer)
    } catch (error) {
      console.error('Failed to save encrypted database:', error)
    }
  }
}

// 用户会话初始化
async function initializeUserSession(userId: string, masterPassword: string): Promise<void> {
  try {
    // 内存数据库初始化
    await globalMemoryDatabase.init()

    // 初始化加密管理器
    await encryptionManager.init(userId, masterPassword)

    // 尝试加载已有的加密数据库
    try {
      const exists = await encryptionManager.encryptedDatabaseExists()
      if (exists) {
        const dbBuffer = await encryptionManager.loadEncryptedDatabase()
        if (dbBuffer.length > 0) {
          await globalMemoryDatabase.loadFromBuffer(dbBuffer)
        }
      }
    } catch (error) {
      console.error('Failed to load encrypted database:', error)
    }

    // 设置自动锁定
    setupAutoLock()
  } catch (error) {
    console.error('Error during user session initialization:', error)
    throw error
  }
}

// 添加用户退出处理函数
async function handleUserLogout(): Promise<void> {
  try {
    // 保存当前用户的内存数据库到加密文件
    await saveMemoryDbToEncryptedFile()

    // 清除内存数据库
    await globalMemoryDatabase.close()

    // 清理状态
    encryptionManager.close()

    // 清除自动锁定定时器
    if (autoLockTimeout) {
      clearTimeout(autoLockTimeout)
      autoLockTimeout = null
    }

    console.log('User logged out successfully')
  } catch (error) {
    console.error('Error during user logout:', error)
    throw error
  }
}

// 自动锁定功能
function setupAutoLock(): void {
  // 清除现有的自动锁定定时器
  if (autoLockTimeout) {
    clearTimeout(autoLockTimeout)
  }

  // 设置自动锁定
  autoLockTimeout = setTimeout(async () => {
    try {
      // 保存数据到加密文件
      await saveMemoryDbToEncryptedFile()

      // 清除内存数据库
      await globalMemoryDatabase.close()

      // 清理状态
      encryptionManager.close()

      // 通知渲染进程应用已锁定
      if (mainWindow) {
        mainWindow.webContents.send('app-locked')
      }

      console.log('Application auto-locked due to inactivity')
    } catch (error) {
      console.error('Error during auto-lock:', error)
    }
  }, autoLockTime)
}

// 更新自动锁定时间
function updateAutoLockTime(newTime: number): void {
  autoLockTime = newTime
  // 如果已经设置了定时器，重新设置
  if (autoLockTimeout) {
    setupAutoLock()
  }
}

// IPC 通信处理
ipcMain.handle('get-passwords', async () => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  return await PasswordsTable.getAllPasswords()
})

// 公共的KDBX模块加载和Argon2设置函数
async function setupKdbxEnvironment() {
  const kdbxwebModule = await import('kdbxweb')
  // 根据实际导入结构调整访问方式
  const kdbxweb = kdbxwebModule.default || kdbxwebModule

  const argon2Module = await import('argon2')
  const argon2 = argon2Module.default || argon2Module

  // 设置Argon2实现
  kdbxweb.CryptoEngine.setArgon2Impl(
    async (password, salt, memory, iterations, length, parallelism, type) => {
      try {
        // 确保参数是正确的类型
        let passwordBuffer: Buffer | string
        if (typeof password === 'string') {
          passwordBuffer = password
        } else if (Array.isArray(password)) {
          passwordBuffer = Buffer.from(password)
        } else if (password instanceof Uint8Array) {
          passwordBuffer = Buffer.from(password)
        } else {
          // 如果是其他类型，尝试转换为字符串再处理
          passwordBuffer = String(password)
        }

        let saltBuffer: Buffer
        if (typeof salt === 'string') {
          saltBuffer = Buffer.from(salt, 'utf-8')
        } else if (Array.isArray(salt)) {
          saltBuffer = Buffer.from(salt)
        } else if (salt instanceof Uint8Array) {
          saltBuffer = Buffer.from(salt)
        } else {
          // 如果是其他类型，尝试转换为字符串再处理
          saltBuffer = Buffer.from(String(salt), 'utf-8')
        }

        // 调用argon2.hash进行哈希计算，使用正确的参数格式
        const rawResult = await argon2.hash(passwordBuffer, {
          salt: saltBuffer,
          timeCost: iterations,
          memoryCost: memory,
          parallelism: parallelism,
          hashLength: length,
          type: type,
          raw: true
        })

        // 返回Uint8Array格式结果
        return new Uint8Array(rawResult)
      } catch (error) {
        console.error('Error in Argon2 implementation:', error)
        throw error
      }
    }
  )

  return { kdbxweb, argon2 }
}

// 添加KDBX导出处理
ipcMain.handle('export-to-kdbx', async (_event, passwords, masterPassword) => {
  try {
    const { kdbxweb } = await setupKdbxEnvironment()

    // 创建新的KDBX数据库
    if (!kdbxweb.ProtectedValue) {
      console.error('kdbxweb.ProtectedValue is undefined')
      throw new Error('kdbxweb.ProtectedValue is undefined')
    }

    if (!kdbxweb.ProtectedValue.fromString) {
      console.error('kdbxweb.ProtectedValue.fromString is undefined')
      throw new Error('kdbxweb.ProtectedValue.fromString is undefined')
    }

    console.log('export:', masterPassword)
    // 即使masterPassword为空，也要确保创建有效的凭证
    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromString(masterPassword || '')
    )

    const db = kdbxweb.Kdbx.create(credentials, 'SPass')

    // 创建一个映射来跟踪已创建的组
    const groupMap = new Map<string, any>()
    groupMap.set('', db.getDefaultGroup()) // 根组

    // 创建密码条目
    passwords.forEach((password: any, index) => {
      try {
        // 获取或创建组
        const groupName = password.group || 'other'
        let group = groupMap.get(groupName)

        if (!group) {
          // 如果组不存在，则创建它
          group = db.createGroup(db.getDefaultGroup(), groupName)
          groupMap.set(groupName, group)
        }

        // 在指定的组中创建条目
        const entry = db.createEntry(group)
        entry.fields.set('Title', password.service)
        entry.fields.set('UserName', password.username)
        entry.fields.set('Password', kdbxweb.ProtectedValue.fromString(password.password))
        if (password.url) {
          entry.fields.set('URL', password.url)
        }
        if (password.notes) {
          entry.fields.set('Notes', password.notes)
        }
        // 添加自定义字段
        entry.fields.set('Group', groupName)
      } catch (entryError) {
        console.error(`Error creating entry ${index}:`, entryError)
        throw entryError
      }
    })

    // 保存数据库
    // const prettyPrintedXml = await db.saveXml(true)
    // console.log(prettyPrintedXml)
    return await db.save()
  } catch (error) {
    console.error('KDBX导出失败:', error)
    console.error('Error stack:', error.stack)
    throw error
  }
})

// 添加KDBX导入处理
ipcMain.handle('import-from-kdbx', async (_event, fileData, masterPassword) => {
  try {
    const { kdbxweb } = await setupKdbxEnvironment()

    // 加载KDBX数据库
    if (!kdbxweb.ProtectedValue) {
      console.error('kdbxweb.ProtectedValue is undefined')
      throw new Error('kdbxweb.ProtectedValue is undefined')
    }

    if (!kdbxweb.ProtectedValue.fromString) {
      console.error('kdbxweb.ProtectedValue.fromString is undefined')
      throw new Error('kdbxweb.ProtectedValue.fromString is undefined')
    }

    console.log('import:', masterPassword)
    // 确保即使masterPassword为空也创建有效的凭证
    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromString(masterPassword || '')
    )

    // 确保 fileData 是 ArrayBuffer 类型
    let arrayBuffer: ArrayBuffer
    if (fileData instanceof ArrayBuffer) {
      arrayBuffer = fileData
    } else if (fileData instanceof Uint8Array) {
      arrayBuffer = fileData.buffer.slice(
        fileData.byteOffset,
        fileData.byteOffset + fileData.byteLength
      )
    } else {
      // 如果是普通数组，转换为 ArrayBuffer
      arrayBuffer = new Uint8Array(fileData).buffer
    }

    const db = await kdbxweb.Kdbx.load(arrayBuffer, credentials)

    // 提取密码条目
    const passwords: any[] = []

    // 递归遍历所有组和子组
    function traverseGroups(groups: any[], path: string = '') {
      groups.forEach((group) => {
        const currentPath = path ? `${path}/${group.name}` : group.name

        // 处理组中的条目
        group.entries.forEach((entry: any) => {
          passwords.push({
            service: entry.fields.get('Title') || '',
            username: entry.fields.get('UserName') || '',
            password: entry.fields.get('Password')
              ? kdbxweb.ByteUtils.bytesToString(entry.fields.get('Password').getBinary())
              : '',
            url: entry.fields.get('URL') || '',
            notes: entry.fields.get('Notes') || '',
            group: entry.fields.get('Group') || group.name || 'other'
          })
        })

        // 递归处理子组
        if (group.groups && group.groups.length > 0) {
          traverseGroups(group.groups, currentPath)
        }
      })
    }

    // 开始遍历根组
    traverseGroups(db.groups)

    return passwords
  } catch (error) {
    console.error('KDBX导入失败:', error)
    console.error('Error stack:', error.stack)
    throw error
  }
})

ipcMain.handle('add-password', async (_event, passwordData) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  // 加密密码
  const encryptedPasswordData = {
    ...passwordData,
    password: JSON.stringify(encryptionManager.encryptPassword(passwordData.password))
  }

  const result = await PasswordsTable.addPassword(encryptedPasswordData)

  // 不再每次操作后保存到加密文件

  return result
})

ipcMain.handle('delete-password', async (_event, id) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  const result = await PasswordsTable.deletePassword(id)

  // 不再每次操作后保存到加密文件

  return result
})

ipcMain.handle('update-password', async (_event, arg) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  const { id, passwordData } = arg

  // 加密密码
  const encryptedPasswordData = {
    ...passwordData,
    password: JSON.stringify(encryptionManager.encryptPassword(passwordData.password))
  }

  const result = await PasswordsTable.updatePassword(id, encryptedPasswordData)

  // 不再每次操作后保存到加密文件

  return result
})

ipcMain.handle('search-passwords', async (_event, query) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  return await PasswordsTable.searchPasswords(query)
})

// 用户认证相关IPC处理
ipcMain.handle('register-user', async (_event, username, password) => {
  try {
    return await AuthCenter.registerUser(username, password)
  } catch (error) {
    console.error('Failed to register user:', error)
    throw error
  }
})

ipcMain.handle('validate-user', async (_event, username, password) => {
  try {
    const isValid = await AuthCenter.validateUser(username, password)

    if (isValid) {
      try {
        // 获取用户信息以获取用户ID
        const user = await AuthCenter.getUserByUsername(username)

        if (user && user.id) {
          // 初始化用户会话
          await initializeUserSession(user.id.toString(), password)
        }
      } catch (error) {
        console.error('Error during user session initialization:', error)
        throw error
      }
    }

    return isValid
  } catch (error) {
    console.error('Failed to validate user:', error)
    throw error
  }
})

ipcMain.handle('user-exists', async (_event, username) => {
  try {
    return await AuthCenter.userExists(username)
  } catch (error) {
    console.error('Failed to check if user exists:', error)
    throw error
  }
})

// 手动锁定应用
ipcMain.handle('lock-application', async () => {
  try {
    // 保存数据到加密文件（手动锁定时仍然保存）
    await saveMemoryDbToEncryptedFile()

    // 清除内存数据库
    await globalMemoryDatabase.close()

    // 清理状态
    encryptionManager.close()

    // 清除自动锁定定时器
    if (autoLockTimeout) {
      clearTimeout(autoLockTimeout)
      autoLockTimeout = null
    }

    return true
  } catch (error) {
    console.error('Lock application failed:', error)
    return false
  }
})

// 用户退出处理
ipcMain.handle('logout-user', async () => {
  await handleUserLogout()
  return true
})

// 检查应用是否已解锁
ipcMain.handle('is-application-locked', async () => {
  return !encryptionManager.isUnlocked()
})

// 解密单个密码
ipcMain.handle('decrypt-password', async (_event, encryptedPassword) => {
  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  try {
    const encryptedData = JSON.parse(encryptedPassword)
    return encryptionManager.decryptPassword(encryptedData)
  } catch (error) {
    console.error('Failed to decrypt password:', error)
    throw new Error('Failed to decrypt password')
  }
})

// 切换收藏状态
ipcMain.handle('toggle-favorite', async (_event, id) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  const result = await PasswordsTable.toggleFavorite(id)

  // 不再每次操作后保存到加密文件

  return result
})

// 更新自动锁定时间
ipcMain.handle('update-auto-lock-time', async (_event, time) => {
  updateAutoLockTime(time)
  return true
})

// 获取网站favicon
ipcMain.handle('get-website-favicon', async (_event, url) => {
  if (!url) return null

  try {
    // 如果URL没有协议，自动添加https://
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url
    }

    const urlObj = new URL(url)

    // 多种备选方案获取favicon
    const faviconUrls = [
      // 直接从网站根目录获取
      `${urlObj.origin}/favicon.ico`,
      // 使用国内可用的服务
      `https://favicon.cccyun.cc/${urlObj.hostname}`,
      `https://api.iowen.cn/favicon/${urlObj.hostname}.png`,
      // 备用方案
      `https://${urlObj.hostname}/favicon.ico`
    ]

    // 创建一个 AbortController 用于设置超时
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 5000) // 5秒超时

    try {
      // 尝试每个URL，返回第一个成功的
      for (const faviconUrl of faviconUrls) {
        try {
          const response = await fetch(faviconUrl, {
            signal: controller.signal,
            timeout: 5000
          })

          if (response.ok) {
            // 检查内容长度，避免获取过大的文件
            const contentLength = response.headers.get('content-length')
            if (contentLength && parseInt(contentLength) > 1024 * 1024) {
              // 1MB限制
              console.warn(`Favicon too large: ${faviconUrl}`)
              continue
            }

            // 获取图片数据并转换为base64
            const buffer = await response.arrayBuffer()

            // 检查实际数据大小
            if (buffer.byteLength > 1024 * 1024) {
              // 1MB限制
              console.warn(`Favicon too large: ${faviconUrl}`)
              continue
            }

            const base64 = Buffer.from(buffer).toString('base64')
            const mimeType = response.headers.get('content-type') || 'image/x-icon'
            clearTimeout(timeout)
            console.log(`Successfully loaded favicon from: ${faviconUrl}`)
            return `data:${mimeType};base64,${base64}`
          } else {
            console.warn(`Failed to fetch favicon from: ${faviconUrl}, status: ${response.status}`)
          }
        } catch (e) {
          console.warn(`Error fetching favicon from: ${faviconUrl}`, e)
          // 继续尝试下一个URL
          continue
        }
      }
    } finally {
      clearTimeout(timeout)
    }

    // 如果所有URL都失败，返回null
    console.log(`Failed to load favicon for: ${url}`)
    return null
  } catch (error) {
    console.error('获取网站favicon失败:', error)
    return null
  }
})

// 获取存储的favicon
ipcMain.handle('get-stored-favicon', async (_event, url) => {
  if (!url) return null

  try {
    return await FaviconsTable.getStoredFavicon(url)
  } catch (error) {
    console.error('获取存储的favicon失败:', error)
    return null
  }
})

// 保存网站favicon
ipcMain.handle('save-website-favicon', async (_event, url, faviconData) => {
  if (!url || !faviconData) return

  try {
    await FaviconsTable.saveWebsiteFavicon(url, faviconData)
  } catch (error) {
    console.error('保存网站favicon失败:', error)
  }
})

// 获取所有favicon数据
ipcMain.handle('get-all-favicons', async () => {
  try {
    const favicons = await FaviconsTable.getAllFavicons()
    return favicons
  } catch (error) {
    console.error('获取所有favicon数据失败:', error)
    return []
  }
})
