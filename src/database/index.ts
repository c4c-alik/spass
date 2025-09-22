import sqlite3 from 'sqlite3'
import { app } from 'electron'
import path from 'path'

// 密码数据模型
export interface PasswordEntry {
  id?: number
  service: string
  username: string
  password: string
  url?: string
  category?: string
  notes?: string
  strength?: 'weak' | 'medium' | 'strong'
  isFavorited?: boolean
  createdAt?: string
  updatedAt?: string
}

// 定义数据库操作结果类型
interface DatabaseRunResult {
  lastID?: number
  changes?: number
}

// 将 sqlite3 转换为 Promise 形式
const promisifyDatabase = (db: sqlite3.Database) => {
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

class PasswordDatabase {
  private readonly dbPath: string
  private db: PromisifiedDatabase | null = null

  constructor() {
    // 确定数据库路径
    this.dbPath = path.join(app.getPath('userData'), 'passwords.db')
  }

  // 初始化数据库
  async init(): Promise<PromisifiedDatabase> {
    if (this.db) {
      return this.db
    }

    const db = new sqlite3.Database(this.dbPath)
    this.db = promisifyDatabase(db)

    // 创建密码表
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS passwords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        url TEXT,
        category TEXT DEFAULT 'other',
        notes TEXT,
        strength TEXT DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建索引
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_service ON passwords(service)')
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_category ON passwords(category)')

    console.log('Database initialized at:', this.dbPath)
    return this.db
  }

  // 添加密码
  async addPassword(password: PasswordEntry): Promise<number | undefined> {
    try {
      const db = await this.init()
      const result = await db.run(
        `INSERT INTO passwords (service, username, password, url, category, notes, strength)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          password.service,
          password.username,
          password.password,
          password.url || null,
          password.category || 'other',
          password.notes || null,
          password.strength || 'medium'
        ]
      )
      return result.lastID
    } catch (error) {
      console.error('Failed to add password:', error)
      throw error
    }
  }

  // 获取所有密码
  async getAllPasswords(): Promise<PasswordEntry[]> {
    try {
      const db = await this.init()
      return db.all<PasswordEntry>(`
        SELECT id, service, username, password, url, category, notes, strength,
               datetime(created_at) as createdAt,
               datetime(updated_at) as updatedAt
        FROM passwords
        ORDER BY service
      `)
    } catch (error) {
      console.error('Failed to get passwords:', error)
      throw error
    }
  }

  // 更新密码
  async updatePassword(id: number, password: PasswordEntry): Promise<number> {
    try {
      if (!id) {
        throw new Error('Password ID is required for update')
      }

      const db = await this.init()
      const result = await db.run(
        `UPDATE passwords SET
          service = ?,
          username = ?,
          password = ?,
          url = ?,
          category = ?,
          notes = ?,
          strength = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          password.service,
          password.username,
          password.password,
          password.url || null,
          password.category || 'other',
          password.notes || null,
          password.strength || 'medium',
          id
        ]
      )
      return result.changes || 0
    } catch (error) {
      console.error('Failed to update password:', error)
      throw error
    }
  }

  // 删除密码
  async deletePassword(id: number): Promise<number> {
    try {
      if (!id) {
        throw new Error('Password ID is required for deletion')
      }

      const db = await this.init()
      const result = await db.run(
        'DELETE FROM passwords WHERE id = ?',
        [id]
      )
      return result.changes || 0
    } catch (error) {
      console.error('Failed to delete password:', error)
      throw error
    }
  }

  // 按服务搜索密码
  async searchPasswords(query: string): Promise<PasswordEntry[]> {
    try {
      if (!query) {
        return this.getAllPasswords()
      }

      const db = await this.init()
      return db.all<PasswordEntry>(`
        SELECT id, service, username, password, url, category, notes, strength,
               datetime(created_at) as createdAt,
               datetime(updated_at) as updatedAt
        FROM passwords
        WHERE service LIKE ? OR username LIKE ? OR url LIKE ?
        ORDER BY service
      `, [`%${query}%`, `%${query}%`, `%${query}%`])
    } catch (error) {
      console.error('Failed to search passwords:', error)
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

export default PasswordDatabase
