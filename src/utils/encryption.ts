import argon2 from 'argon2'
import crypto from 'crypto'
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'

// 加密配置
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  authTagLength: 16,
  saltLength: 16
}

// 内存数据库接口
export interface EncryptedPasswordEntry {
  id?: number
  service: string
  username: string
  password: string // 这里存储的是加密后的密码
  url?: string
  category?: string
  notes?: string
  strength?: 'weak' | 'medium' | 'strong'
  createdAt?: string
  updatedAt?: string
}

export class EncryptionManager {
  private masterKey: Buffer | null = null
  private dbPath: string
  private encryptedDbPath: string
  private userId: string | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'passwords.db')
    // 默认加密数据库路径，但会在用户登录时更新
    this.encryptedDbPath = path.join(userDataPath, 'passwords.db.encrypted')
    this.userId = null
  }

  /**
   * 设置当前用户ID，用于创建用户特定的加密数据库文件
   * @param userId 用户ID
   */
  setUserId(userId: string): void {
    this.userId = userId
    const userDataPath = app.getPath('userData')
    // 为每个用户创建唯一的加密数据库文件
    this.encryptedDbPath = path.join(userDataPath, `passwords_${userId}.db.encrypted`)
  }

  /**
   * 从主密码派生加密密钥
   * @param masterPassword 用户主密码
   * @param salt 盐值
   * @returns 派生的密钥
   */
  async deriveKey(masterPassword: string, salt: Buffer): Promise<Buffer> {
    // 直接使用argon2生成指定长度的密钥
    const key = await argon2.hash(masterPassword, {
      type: argon2.argon2id,
      salt: salt,
      hashLength: ENCRYPTION_CONFIG.keyLength,
      timeCost: 3,
      memoryCost: 2 ** 16,
      parallelism: 1
    })

    // 从PHC格式的hash中提取实际的哈希值部分
    const parts = key.split('$')
    const hashBuffer = Buffer.from(parts[4], 'base64')
    // 确保返回的密钥长度正确
    const derivedKey = hashBuffer.slice(0, ENCRYPTION_CONFIG.keyLength)

    // 确保密钥长度正确（32字节用于AES-256）
    // 如果派生的密钥长度不足，用0填充到所需长度
    if (derivedKey.length < ENCRYPTION_CONFIG.keyLength) {
      const padding = Buffer.alloc(ENCRYPTION_CONFIG.keyLength - derivedKey.length, 0)
      return Buffer.concat([derivedKey, padding])
    }

    if (derivedKey.length > ENCRYPTION_CONFIG.keyLength) {
      return derivedKey.slice(0, ENCRYPTION_CONFIG.keyLength)
    }

    return derivedKey
  }

  /**
   * 设置主密钥
   * @param masterPassword 用户主密码
   */
  async setMasterKey(masterPassword: string): Promise<void> {
    const salt = await this.getOrCreateSalt()
    this.masterKey = await this.deriveKey(masterPassword, salt)
  }

  /**
   * 获取或创建盐值
   * @returns 盐值
   */
  private async getOrCreateSalt(): Promise<Buffer> {
    const saltPath = path.join(app.getPath('userData'), 'salt')
    try {
      // 尝试读取现有的盐值
      const salt = await fs.readFile(saltPath)
      return salt
    } catch {
      // 如果盐值文件不存在，则创建新的盐值
      const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength)
      await fs.writeFile(saltPath, salt)
      return salt
    }
  }

  /**
   * 加密单个密码条目
   * @param plaintext 明文密码
   * @returns 加密后的密码和元数据
   */
  encryptPassword(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    if (!this.masterKey) {
      throw new Error('Master key not set')
    }

    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength)
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, this.masterKey, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag()

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    }
  }

  /**
   * 解密单个密码条目
   * @param encryptedData 加密的数据对象
   * @returns 解密后的明文密码
   */
  decryptPassword(encryptedData: { encrypted: string; iv: string; authTag: string }): string {
    if (!this.masterKey) {
      throw new Error('Master key not set')
    }

    const iv = Buffer.from(encryptedData.iv, 'hex')
    const authTag = Buffer.from(encryptedData.authTag, 'hex')
    const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, this.masterKey, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  /**
   * 加密整个数据库文件
   * @param dbData 数据库文件内容
   * @returns 加密后的数据
   */
  async encryptDatabaseFile(dbData: Buffer): Promise<Buffer> {
    if (!this.masterKey) {
      throw new Error('Master key not set')
    }

    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength)
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, this.masterKey, iv)
    const encrypted = Buffer.concat([cipher.update(dbData), cipher.final()])
    const authTag = cipher.getAuthTag()

    // 将 IV、authTag 和加密数据组合在一起
    return Buffer.concat([iv, authTag, encrypted])
  }

  /**
   * 解密整个数据库文件
   * @param encryptedData 加密的数据
   * @returns 解密后的数据库文件内容
   */
  async decryptDatabaseFile(encryptedData: Buffer): Promise<Buffer> {
    if (!this.masterKey) {
      throw new Error('Master key not set')
    }

    const iv = encryptedData.subarray(0, ENCRYPTION_CONFIG.ivLength)
    const authTag = encryptedData.subarray(
      ENCRYPTION_CONFIG.ivLength,
      ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.authTagLength
    )
    const data = encryptedData.subarray(
      ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.authTagLength
    )

    const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, this.masterKey, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(data), decipher.final()])
  }

  /**
   * 保存加密的数据库文件
   * @param dbData 数据库文件内容
   */
  async saveEncryptedDatabase(dbData: Buffer): Promise<void> {
    const encryptedData = await this.encryptDatabaseFile(dbData)
    await fs.writeFile(this.encryptedDbPath, encryptedData)
  }

  /**
   * 加载并解密数据库文件
   * @returns 解密后的数据库文件内容
   */
  async loadEncryptedDatabase(): Promise<Buffer> {
    try {
      const encryptedData = await fs.readFile(this.encryptedDbPath)
      return await this.decryptDatabaseFile(encryptedData)
    } catch {
      // 如果加密的数据库文件不存在，返回空的数据库
      return Buffer.from('')
    }
  }

  /**
   * 检查加密的数据库文件是否存在
   * @returns 是否存在加密的数据库文件
   */
  async encryptedDatabaseExists(): Promise<boolean> {
    try {
      await fs.access(this.encryptedDbPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 清除主密钥（锁定）
   */
  clearMasterKey(): void {
    this.masterKey = null
  }

  /**
   * 检查是否已设置主密钥（是否已解锁）
   * @returns 是否已解锁
   */
  isUnlocked(): boolean {
    return this.masterKey !== null
  }
}

// 创建全局加密管理器实例
export const encryptionManager = new EncryptionManager()
