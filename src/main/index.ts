import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import UserDatabase from '../database/userDatabase'
import { encryptionManager } from '../utils/encryption'
import { MemoryDatabase } from '../database/memoryDatabase'

// 设置应用区域和语言
app.commandLine.appendSwitch('lang', 'zh-CN')
app.commandLine.appendSwitch('locale', 'zh-CN')

let userDb: UserDatabase
let memoryDb: MemoryDatabase
let autoLockTimeout: NodeJS.Timeout | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
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
    mainWindow.show()
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
app.whenReady().then(() => {
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

  // 初始化数据库
  userDb = new UserDatabase()
  memoryDb = new MemoryDatabase()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
app.on('before-quit', async () => {
  // 在退出前保存内存数据库到加密文件
  await saveMemoryDbToEncryptedFile()
  await userDb.close()
  await memoryDb.close()
})

// 保存内存数据库到加密文件
async function saveMemoryDbToEncryptedFile(): Promise<void> {
  if (encryptionManager.isUnlocked()) {
    try {
      const dbBuffer = await memoryDb.exportToBuffer()
      console.log(dbBuffer)
      await encryptionManager.saveEncryptedDatabase(dbBuffer)
    } catch (error) {
      console.error('Failed to save encrypted database:', error)
    }
  }
}

// 自动锁定功能
function setupAutoLock(): void {
  // 清除现有的自动锁定定时器
  if (autoLockTimeout) {
    clearTimeout(autoLockTimeout)
  }

  // 设置30分钟无操作自动锁定
  autoLockTimeout = setTimeout(
    async () => {
      // 保存数据到加密文件
      await saveMemoryDbToEncryptedFile()

      // 清除内存数据库
      await memoryDb.close()
      memoryDb = new MemoryDatabase()

      // 清除主密钥
      encryptionManager.clearMasterKey()

      console.log('Application auto-locked due to inactivity')
    },
    30 * 60 * 1000
  ) // 30分钟
}

// IPC 通信处理
ipcMain.handle('get-passwords', async () => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  return await memoryDb.getAllPasswords()
})

// 添加KDBX导出处理
ipcMain.handle('export-to-kdbx', async (_event, passwords, masterPassword) => {
  try {
    const kdbxweb = await import('kdbxweb')
    const argon2 = await import('argon2')

    // 设置Argon2实现
    kdbxweb.CryptoEngine.setArgon2Impl(
      (password, salt, memory, iterations, length, parallelism, type) => {
        // 将密码和盐值转换为Buffer
        const passwordBuffer = kdbxweb.ByteUtils.arrayToBuffer(
          typeof password === 'string' ? kdbxweb.ByteUtils.stringToBytes(password) : password
        )
        const saltBuffer = kdbxweb.ByteUtils.arrayToBuffer(
          typeof salt === 'string' ? kdbxweb.ByteUtils.stringToBytes(salt) : salt
        )

        // 调用argon2.hash进行哈希计算
        return argon2
          .hash({
            pass: passwordBuffer,
            salt: saltBuffer,
            time: iterations,
            mem: memory,
            parallelism: parallelism,
            type: type,
            hashLen: length
          })
          .then((result: any) => {
            // 返回Uint8Array格式结果
            return kdbxweb.ByteUtils.arrayToBuffer(result.hash)
          })
      }
    )

    // 创建新的KDBX数据库
    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromBinary(kdbxweb.ByteUtils.stringToBytes(masterPassword || 'spass'))
    )
    const db = kdbxweb.Kdbx.create(credentials, 'SPass')

    // 创建密码条目
    passwords.forEach((password: any) => {
      const entry = db.createEntry(db.getDefaultGroup())
      entry.fields.Title = password.service
      entry.fields.UserName = password.username
      entry.fields.Password = kdbxweb.ProtectedValue.fromBinary(
        kdbxweb.ByteUtils.stringToBytes(password.password)
      )
      if (password.url) {
        entry.fields.URL = password.url
      }
      if (password.notes) {
        entry.fields.Notes = password.notes
      }
      // 添加自定义字段
      entry.fields.Category = password.category || 'other'
    })

    // 保存数据库
    return await db.save()
  } catch (error) {
    console.error('KDBX导出失败:', error)
    throw error
  }
})

// 添加KDBX导入处理
ipcMain.handle('import-from-kdbx', async (_event, fileData, masterPassword) => {
  try {
    const kdbxweb = await import('kdbxweb')
    const argon2 = await import('argon2')

    // 设置Argon2实现
    kdbxweb.CryptoEngine.setArgon2Impl(
      (password, salt, memory, iterations, length, parallelism, type) => {
        // 将密码和盐值转换为Buffer
        const passwordBuffer = kdbxweb.ByteUtils.arrayToBuffer(
          typeof password === 'string' ? kdbxweb.ByteUtils.stringToBytes(password) : password
        )
        const saltBuffer = kdbxweb.ByteUtils.arrayToBuffer(
          typeof salt === 'string' ? kdbxweb.ByteUtils.stringToBytes(salt) : salt
        )

        // 调用argon2.hash进行哈希计算
        return argon2
          .hash({
            pass: passwordBuffer,
            salt: saltBuffer,
            time: iterations,
            mem: memory,
            parallelism: parallelism,
            type: type,
            hashLen: length
          })
          .then((result: any) => {
            // 返回Uint8Array格式结果
            return kdbxweb.ByteUtils.arrayToBuffer(result.hash)
          })
      }
    )

    // 加载KDBX数据库
    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromBinary(kdbxweb.ByteUtils.stringToBytes(masterPassword))
    )

    const db = await kdbxweb.Kdbx.load(new Uint8Array(fileData), credentials)

    // 提取密码条目
    const passwords: any[] = []
    db.groups.forEach((group) => {
      group.entries.forEach((entry) => {
        passwords.push({
          service: entry.fields.Title || '',
          username: entry.fields.UserName || '',
          password: entry.fields.Password
            ? kdbxweb.ByteUtils.bytesToString(entry.fields.Password.getBinary())
            : '',
          url: entry.fields.URL || '',
          notes: entry.fields.Notes || '',
          category: entry.fields.Category || 'other'
        })
      })
    })

    return passwords
  } catch (error) {
    console.error('KDBX导入失败:', error)
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

  const result = await memoryDb.addPassword(encryptedPasswordData)

  // 保存到加密文件
  await saveMemoryDbToEncryptedFile()

  return result
})

ipcMain.handle('delete-password', async (_event, id) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  const result = await memoryDb.deletePassword(id)

  // 保存到加密文件
  await saveMemoryDbToEncryptedFile()

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

  const result = await memoryDb.updatePassword(id, encryptedPasswordData)

  // 保存到加密文件
  await saveMemoryDbToEncryptedFile()

  return result
})

ipcMain.handle('search-passwords', async (_event, query) => {
  // 重置自动锁定定时器
  setupAutoLock()

  if (!encryptionManager.isUnlocked()) {
    throw new Error('Application is locked')
  }

  return await memoryDb.searchPasswords(query)
})

// 用户认证相关IPC处理
ipcMain.handle('register-user', async (_event, username, password) => {
  return await userDb.registerUser(username, password)
})

ipcMain.handle('validate-user', async (_event, username, password) => {
  const isValid = await userDb.validateUser(username, password)

  if (isValid) {
    // 设置主密钥
    await encryptionManager.setMasterKey(password)

    // 初始化内存数据库
    await memoryDb.init()

    // 尝试加载已有的加密数据库
    try {
      const exists = await encryptionManager.encryptedDatabaseExists()
      if (exists) {
        const dbBuffer = await encryptionManager.loadEncryptedDatabase()
        if (dbBuffer.length > 0) {
          await memoryDb.loadFromBuffer(dbBuffer)
        }
      }
    } catch (error) {
      console.error('Failed to load encrypted database:', error)
    }

    // 设置自动锁定
    setupAutoLock()
  }

  return isValid
})

ipcMain.handle('user-exists', async (_event, username) => {
  return await userDb.userExists(username)
})

// 手动锁定应用
ipcMain.handle('lock-application', async () => {
  // 保存数据到加密文件
  await saveMemoryDbToEncryptedFile()

  // 清除内存数据库
  await memoryDb.close()
  memoryDb = new MemoryDatabase()

  // 清除主密钥
  encryptionManager.clearMasterKey()

  // 清除自动锁定定时器
  if (autoLockTimeout) {
    clearTimeout(autoLockTimeout)
    autoLockTimeout = null
  }

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

  const result = await memoryDb.toggleFavorite(id)

  // 保存到加密文件
  await saveMemoryDbToEncryptedFile()

  return result
})
