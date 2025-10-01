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

  app.on('activate', function() {
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
    console.log('Starting KDBX export process')
    const kdbxwebModule = await import('kdbxweb')
    console.log('kdbxweb module loaded:', kdbxwebModule)
    console.log('kdbxwebModule.default:', kdbxwebModule.default)

    // 根据实际导入结构调整访问方式
    const kdbxweb = kdbxwebModule.default || kdbxwebModule
    console.log('kdbxweb object:', kdbxweb)

    const argon2Module = await import('argon2')
    const argon2 = argon2Module.default || argon2Module
    console.log('argon2 module loaded:', argon2)
    console.log('aaaa')

    // 设置Argon2实现
    console.log('Setting Argon2 implementation')
    kdbxweb.CryptoEngine.setArgon2Impl(
      async (password, salt, memory, iterations, length, parallelism, type) => {
        console.log('Argon2 implementation called with params:', {
          memory,
          iterations,
          length,
          parallelism,
          type
        })
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

          console.log('Password buffer created, type:', typeof passwordBuffer)
          console.log('Salt buffer created, type:', typeof saltBuffer)

          // 调用argon2.hash进行哈希计算，使用正确的参数格式
          const result = await argon2.hash(passwordBuffer, {
            salt: saltBuffer,
            timeCost: iterations,
            memoryCost: memory,
            parallelism: parallelism,
            hashLength: length,
            type: type
          })

          console.log('Argon2 hash completed')
          // 返回Uint8Array格式结果
          if (typeof result === 'string') {
            // 如果结果是字符串，需要解码
            const rawResult = await argon2.hash(passwordBuffer, {
              salt: saltBuffer,
              timeCost: iterations,
              memoryCost: memory,
              parallelism: parallelism,
              hashLength: length,
              type: type,
              raw: true
            })
            return new Uint8Array(rawResult)
          } else {
            // 如果结果是Buffer，直接转换为Uint8Array
            return new Uint8Array(result)
          }
        } catch (error) {
          console.error('Error in Argon2 implementation:', error)
          throw error
        }
      }
    )

    // 创建新的KDBX数据库
    console.log('Creating KDBX credentials')
    console.log('kdbxweb.KdbxCredentials:', kdbxweb.KdbxCredentials)
    console.log('kdbxweb.ProtectedValue:', kdbxweb.ProtectedValue)

    if (!kdbxweb.ProtectedValue) {
      console.error('kdbxweb.ProtectedValue is undefined')
      throw new Error('kdbxweb.ProtectedValue is undefined')
    }

    if (!kdbxweb.ProtectedValue.fromBinary) {
      console.error('kdbxweb.ProtectedValue.fromBinary is undefined')
      throw new Error('kdbxweb.ProtectedValue.fromBinary is undefined')
    }

    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromBinary(kdbxweb.ByteUtils.stringToBytes(masterPassword || 'spass'))
    )
    console.log('KDBX credentials created successfully')

    const db = kdbxweb.Kdbx.create(credentials, 'SPass')
    console.log('KDBX database created')

    // 创建密码条目
    console.log('Creating password entries, count:', passwords.length)
    passwords.forEach((password: any, index) => {
      try {
        console.log(`Creating entry ${index}:`, password.service)
        const entry = db.createEntry(db.getDefaultGroup())
        entry.fields.set('Title', password.service)
        entry.fields.set('UserName', password.username)
        entry.fields.set('Password', kdbxweb.ProtectedValue.fromBinary(
          kdbxweb.ByteUtils.stringToBytes(password.password)
        ))
        if (password.url) {
          entry.fields.set('URL', password.url)
        }
        if (password.notes) {
          entry.fields.set('Notes', password.notes)
        }
        // 添加自定义字段
        entry.fields.set('Category', password.category || 'other')
        console.log(`Entry ${index} created successfully`)
      } catch (entryError) {
        console.error(`Error creating entry ${index}:`, entryError)
        throw entryError
      }
    })

    // 保存数据库
    console.log('Saving KDBX database')
    const result = await db.save()
    console.log('KDBX database saved successfully')
    return result
  } catch (error) {
    console.error('KDBX导出失败:', error)
    console.error('Error stack:', error.stack)
    throw error
  }
})

// 添加KDBX导入处理
ipcMain.handle('import-from-kdbx', async (_event, fileData, masterPassword) => {
  try {
    console.log('Starting KDBX import process')
    const kdbxwebModule = await import('kdbxweb')
    console.log('kdbxweb module loaded:', kdbxwebModule)
    console.log('kdbxwebModule.default:', kdbxwebModule.default)

    // 根据实际导入结构调整访问方式
    const kdbxweb = kdbxwebModule.default || kdbxwebModule
    console.log('kdbxweb object:', kdbxweb)

    const argon2Module = await import('argon2')
    const argon2 = argon2Module.default || argon2Module
    console.log('argon2 module loaded:', argon2)

    // 设置Argon2实现
    console.log('Setting Argon2 implementation for import')
    kdbxweb.CryptoEngine.setArgon2Impl(
      async (password, salt, memory, iterations, length, parallelism, type) => {
        console.log('Argon2 implementation called with params:', {
          memory,
          iterations,
          length,
          parallelism,
          type
        })
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

          console.log('Password buffer created, type:', typeof passwordBuffer)
          console.log('Salt buffer created, type:', typeof saltBuffer)

          // 调用argon2.hash进行哈希计算，使用正确的参数格式
          const result = await argon2.hash(passwordBuffer, {
            salt: saltBuffer,
            timeCost: iterations,
            memoryCost: memory,
            parallelism: parallelism,
            hashLength: length,
            type: type
          })

          console.log('Argon2 hash completed')
          // 返回Uint8Array格式结果
          if (typeof result === 'string') {
            // 如果结果是字符串，需要解码
            const rawResult = await argon2.hash(passwordBuffer, {
              salt: saltBuffer,
              timeCost: iterations,
              memoryCost: memory,
              parallelism: parallelism,
              hashLength: length,
              type: type,
              raw: true
            })
            return new Uint8Array(rawResult)
          } else {
            // 如果结果是Buffer，直接转换为Uint8Array
            return new Uint8Array(result)
          }
        } catch (error) {
          console.error('Error in Argon2 implementation:', error)
          throw error
        }
      }
    )

    // 加载KDBX数据库
    console.log('Creating KDBX credentials for import')
    console.log('kdbxweb.KdbxCredentials:', kdbxweb.KdbxCredentials)
    console.log('kdbxweb.ProtectedValue:', kdbxweb.ProtectedValue)

    if (!kdbxweb.ProtectedValue) {
      console.error('kdbxweb.ProtectedValue is undefined')
      throw new Error('kdbxweb.ProtectedValue is undefined')
    }

    if (!kdbxweb.ProtectedValue.fromBinary) {
      console.error('kdbxweb.ProtectedValue.fromBinary is undefined')
      throw new Error('kdbxweb.ProtectedValue.fromBinary is undefined')
    }

    const credentials = new kdbxweb.KdbxCredentials(
      kdbxweb.ProtectedValue.fromBinary(kdbxweb.ByteUtils.stringToBytes(masterPassword))
    )
    console.log('KDBX credentials created successfully')

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
    console.log('KDBX database loaded')

    // 提取密码条目
    const passwords: any[] = []
    db.groups.forEach((group) => {
      console.log('Processing group:', group)
      group.entries.forEach((entry) => {
        console.log('Processing entry:', entry.fields)
        passwords.push({
          service: entry.fields.get('Title') || '',
          username: entry.fields.get('UserName') || '',
          password: entry.fields.get('Password')
            ? kdbxweb.ByteUtils.bytesToString(entry.fields.get('Password').getBinary())
            : '',
          url: entry.fields.get('URL') || '',
          notes: entry.fields.get('Notes') || '',
          category: entry.fields.get('Category') || 'other'
        })
      })
    })

    console.log('Imported passwords count:', passwords.length)
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
