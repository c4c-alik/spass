import sqlite3 from 'sqlite3'
import { promisifyDatabase, PromisifiedDatabase } from '../utils'

// 密码数据模型
export interface PasswordEntry {
  id?: number
  service: string
  username: string
  password: string
  url?: string
  group?: string
  notes?: string
  strength?: 'weak' | 'medium' | 'strong'
  isFavorited?: boolean
  createdAt?: string
  updatedAt?: string
  favicon?: string
}

// 定义内部使用的密码条目类型（数据库字段）
// 用于数据库操作，将布尔类型的 isFavorited 转换为数字类型的 is_favorited
export interface DatabasePasswordEntry extends Omit<
  PasswordEntry,
  'isFavorited' | 'createdAt' | 'updatedAt'
> {
  is_favorited?: number
  created_at?: string
  updated_at?: string
}

export class PasswordsTable {
  static getDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS passwords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        url TEXT,
        "group" TEXT DEFAULT 'other',
        notes TEXT,
        strength TEXT DEFAULT 'medium',
        is_favorited INTEGER DEFAULT 0,
        favicon TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  }

  static async initialize(dbPath: string): Promise<PromisifiedDatabase> {
    const db = new sqlite3.Database(dbPath)
    const promisifiedDb = promisifyDatabase(db)

    // 创建密码表
    await promisifiedDb.exec(this.getDDL())

    // 创建索引
    await promisifiedDb.exec('CREATE INDEX IF NOT EXISTS idx_service ON passwords(service)')
    await promisifiedDb.exec('CREATE INDEX IF NOT EXISTS idx_group ON passwords("group")')

    return promisifiedDb
  }

  static async addPassword(
    db: PromisifiedDatabase,
    password: PasswordEntry
  ): Promise<number | undefined> {
    try {
      const result = await db.run(
        `INSERT INTO passwords (service, username, password, url, "group", notes, strength, favicon, is_favorited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          password.service,
          password.username,
          password.password,
          password.url || null,
          password.group || 'other',
          password.notes || null,
          password.strength || 'medium',
          password.favicon || null,
          password.isFavorited ? 1 : 0
        ]
      )
      return result.lastID
    } catch (error) {
      console.error('Failed to add password:', error)
      throw error
    }
  }

  static async getAllPasswords(db: PromisifiedDatabase): Promise<PasswordEntry[]> {
    try {
      const rows = await db.all<DatabasePasswordEntry[]>(
        `SELECT id, service, username, password, url, "group", notes, strength, favicon, is_favorited as is_favorited,
                datetime(created_at) as created_at,
                datetime(updated_at) as updated_at
         FROM passwords
         ORDER BY service`
      )

      // 将 is_favorited (number) 转换为 isFavorited (boolean)
      return rows.map((row) => ({
        ...row,
        isFavorited: row.is_favorited === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('Failed to get passwords:', error)
      throw error
    }
  }

  static async updatePassword(
    db: PromisifiedDatabase,
    id: number,
    password: PasswordEntry
  ): Promise<number> {
    try {
      if (!id) {
        throw new Error('Password ID is required for update')
      }

      const result = await db.run(
        `UPDATE passwords SET
          service = ?,
          username = ?,
          password = ?,
          url = ?,
          "group" = ?,
          notes = ?,
          strength = ?,
          favicon = ?,
          is_favorited = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          password.service,
          password.username,
          password.password,
          password.url || null,
          password.group || 'other',
          password.notes || null,
          password.strength || 'medium',
          password.favicon || null,
          password.isFavorited ? 1 : 0,
          id
        ]
      )
      return result.changes || 0
    } catch (error) {
      console.error('Failed to update password:', error)
      throw error
    }
  }

  static async deletePassword(db: PromisifiedDatabase, id: number): Promise<number> {
    try {
      if (!id) {
        throw new Error('Password ID is required for deletion')
      }

      const result = await db.run('DELETE FROM passwords WHERE id = ?', [id])
      return result.changes || 0
    } catch (error) {
      console.error('Failed to delete password:', error)
      throw error
    }
  }

  static async searchPasswords(
    db: PromisifiedDatabase,
    searchTerm: string
  ): Promise<PasswordEntry[]> {
    try {
      const query = `%${searchTerm}%`
      const rows = await db.all<DatabasePasswordEntry[]>(
        `SELECT id, service, username, password, url, "group", notes, strength, favicon, is_favorited as is_favorited,
                datetime(created_at) as created_at,
                datetime(updated_at) as updated_at
         FROM passwords
         WHERE service LIKE ? OR username LIKE ?
         ORDER BY service`,
        [query, query]
      )

      // 将 is_favorited (number) 转换为 isFavorited (boolean)
      return rows.map((row) => ({
        ...row,
        isFavorited: row.is_favorited === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('Failed to search passwords:', error)
      throw error
    }
  }

  static async toggleFavorite(db: PromisifiedDatabase, id: number): Promise<void> {
    try {
      // 先获取当前收藏状态
      const row: { is_favorited: number } | undefined = await db.get<{ is_favorited: number }>(
        'SELECT is_favorited FROM passwords WHERE id = ?',
        [id]
      )

      if (!row) {
        throw new Error('Password not found')
      }

      // 切换状态 (0->1, 1->0)
      const newFavoriteStatus = row.is_favorited === 1 ? 0 : 1

      await db.run(
        'UPDATE passwords SET is_favorited = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newFavoriteStatus, id]
      )
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
      throw error
    }
  }
}
