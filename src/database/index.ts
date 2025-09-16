import sqlite3 from 'sqlite3'
import { app } from 'electron'
import path from 'path'

// 密码数据模型
export interface PasswordEntry {
  id?: number;
  service: string;
  username: string;
  password: string;
  url?: string;
  category?: string;
  notes?: string;
  strength?: 'weak' | 'medium' | 'strong';
  createdAt?: Date;
  updatedAt?: Date;
}

class PasswordDatabase {
  private readonly dbPath: string

  constructor() {
    // 确定数据库路径
    this.dbPath = path.join(app.getPath('userData'), 'passwords.db')
  }

  // 初始化数据库
  async init() {
    const db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    })

    // 创建密码表
    await db.exec(`
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
    await db.exec('CREATE INDEX IF NOT EXISTS idx_service ON passwords(service)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_category ON passwords(category)')

    console.log('Database initialized')
    return db
  }

  // 添加密码
  async addPassword(password: PasswordEntry) {
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
  }

  // 获取所有密码
  async getAllPasswords() {
    const db = await this.init()
    return db.all<PasswordEntry[]>(`
      SELECT id, service, username, password, url, category, notes, strength,
             datetime(created_at) as createdAt,
             datetime(updated_at) as updatedAt
      FROM passwords
      ORDER BY service
    `)
  }

  // 更新密码
  async updatePassword(id: number, password: PasswordEntry) {
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
    return result.changes
  }

  // 删除密码
  async deletePassword(id: number) {
    const db = await this.init()
    const result = await db.run(
      'DELETE FROM passwords WHERE id = ?',
      [id]
    )
    return result.changes
  }

  // 按服务搜索密码
  async searchPasswords(query: string) {
    const db = await this.init()
    return db.all<PasswordEntry[]>(`
      SELECT id, service, username, password, url, category, notes, strength,
             datetime(created_at) as createdAt,
             datetime(updated_at) as updatedAt
      FROM passwords
      WHERE service LIKE ? OR username LIKE ? OR url LIKE ?
      ORDER BY service
    `, [`%${query}%`, `%${query}%`, `%${query}%`])
  }
}

export default PasswordDatabase
