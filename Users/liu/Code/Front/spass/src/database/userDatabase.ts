import sqlite3 from 'sqlite3'
import { app } from 'electron'
import path from 'path'
import crypto from 'crypto'
import argon2 from 'argon2'

// 用户数据模型
export interface User {
  id?: number
  username: string
  masterPasswordHash: string
  salt: string
  createdAt?: string
  updatedAt?: string
}

// 定义数据库操作结果类型
interface DatabaseRunResult {
  lastID?: number
  changes?: number
}

// 将 sqlite3 转换为 Promise 形式
const promisifyDatabase = (db: sqlite3.Database): PromisifiedDatabase => {
  return {
    run: (sql: string, params?: (string | number | null)[]): Promise<DatabaseRunResult> => {
      return new Promise((resolve, reject) => {
        db.run(sql, params || [], function(err) {
          if (err) {
            reject(err)
          } else {
            resolve({ lastID: this.lastID, changes: this.changes })
          }
        })
      })
    },
    all: <T>(sql: string, params?: (string | number | null)[]): Promise<T[]> => {
      return new Promise((resolve, reject) => {
        db.all(sql, params || [], (err, rows) => {
          if (err) {
            reject(err)
          } else {
            resolve(rows)
          }
        })
      })
    },
    get: <T>(sql: string, params?: (string | number | null)[]): Promise<T | undefined> => {
      return new Promise((resolve, reject) => {
        db.get(sql, params || [], (err, row) => {
          if (err) {
            reject(err)
          } else {
            resolve(row)
          }
        })
      })
    },
    exec: (sql: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    },
    close: (): Promise<void> => {
      return new Promise((resolve, reject) => {
        db.close((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }
}

type PromisifiedDatabase = ReturnType<typeof promisifyDatabase>

class UserDatabase {
  private readonly dbPath: string
  private db: PromisifiedDatabase | null = null

  constructor() {
    // 确定数据库路径
    this.dbPath = path.join(app.getPath('userData'), 'users.db')
  }

  // 初始化数据库
  async init(): Promise<PromisifiedDatabase> {
    if (this.db) {
      return this.db
    }

    const db = new sqlite3.Database(this.dbPath)
    this.db = promisifyDatabase(db)

    // 创建用户表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        master_password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建索引
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')

    console.log('User database initialized at:', this.dbPath)
    return this.db
  }

  // 生成盐值
  generateSalt(): string {
    return crypto.randomBytes(16).toString('hex')
  }

  // 哈希密码（使用Argon2）
  async hashPassword(password: string, salt: string): Promise<string> {
    return await argon2.hash(password, {
      salt: Buffer.from(salt, 'hex'),
      timeCost: 10,
      memoryCost: 2048,
      parallelism: 1,
      hashLength: 32
    })
  }

  // 注册用户
  async registerUser(username: string, masterPassword: string): Promise<number | undefined> {
    try {
      const salt = this.generateSalt()
      const masterPasswordHash = await this.hashPassword(masterPassword, salt)

      const db = await this.init()
      const result = await db.run(
        `INSERT INTO users (username, master_password_hash, salt)
         VALUES (?, ?, ?)`,
        [username, masterPasswordHash, salt]
      )
      return result.lastID
    } catch (error) {
      console.error('Failed to register user:', error)
      throw error
    }
  }

  // 验证用户登录
  async validateUser(username: string, masterPassword: string): Promise<boolean> {
    try {
      const db = await this.init()
      const user = await db.get<User>(
        'SELECT master_password_hash, salt FROM users WHERE username = ?',
        [username]
      )

      if (!user) {
        return false
      }

      // 使用Argon2验证密码
      return await argon2.verify(user.master_password_hash, masterPassword)
    } catch (error) {
      console.error('Failed to validate user:', error)
      throw error
    }
  }

  // 检查用户是否存在
  async userExists(username: string): Promise<boolean> {
    try {
      const db = await this.init()
      const user = await db.get<User>(
        'SELECT id FROM users WHERE username = ?',
        [username]
      )
      return !!user
    } catch (error) {
      console.error('Failed to check if user exists:', error)
      throw error
    }
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }
}

export default UserDatabase
