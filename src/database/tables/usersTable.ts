import sqlite3 from 'sqlite3'
import argon2 from 'argon2'
import crypto from 'crypto'
import { promisifyDatabase, PromisifiedDatabase, DatabaseRunResult } from '../utils'

// 用户数据模型
export interface User {
  id?: number
  username: string
  masterPasswordHash: string
  salt: string
  createdAt?: string
  updatedAt?: string
}

export class UsersTable {
  static getDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        master_password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  }

  static async initialize(dbPath: string): Promise<PromisifiedDatabase> {
    const db = new sqlite3.Database(dbPath)
    const promisifiedDb = promisifyDatabase(db)
    
    // 创建用户表
    await promisifiedDb.exec(this.getDDL())
    
    // 创建索引
    await promisifiedDb.exec('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')
    
    return promisifiedDb
  }

  // 生成盐值
  static generateSalt(): string {
    return Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18)
  }

  // 使用 Argon2id 哈希密码
  static async hashPassword(password: string): Promise<string> {
    // 生成一个16字节的盐用于Argon2
    const argonSalt = crypto.randomBytes(16)
    return await argon2.hash(password, { 
      type: argon2.argon2id,
      salt: argonSalt,
      hashLength: 32,
      timeCost: 4,
      memoryCost: 2 ** 16,
      parallelism: 2
    })
  }

  // 验证密码
  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      // 确保hash值是有效的PHC格式字符串（以$开头）
      if (!hash.startsWith('$')) {
        console.error('Invalid hash format: missing $ prefix')
        return false
      }
      return await argon2.verify(hash, password)
    } catch (err) {
      console.error('Password verification error:', err)
      return false
    }
  }

  static async registerUser(db: any, username: string, masterPassword: string): Promise<number | undefined> {
    try {
      const salt = this.generateSalt()
      const masterPasswordHash = await this.hashPassword(masterPassword)
      
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

  static async validateUser(db: any, username: string, masterPassword: string): Promise<boolean> {
    try {
      const user = await db.get<{master_password_hash: string, salt: string}>(
        'SELECT master_password_hash, salt FROM users WHERE username = ?',
        [username]
      )
      
      if (!user) {
        return false
      }
      
      return await this.verifyPassword(user.master_password_hash, masterPassword)
    } catch (error) {
      console.error('Failed to validate user:', error)
      throw error
    }
  }

  static async userExists(db: any, username: string): Promise<boolean> {
    try {
      const user = await db.get<{id: number}>(
        'SELECT id FROM users WHERE username = ?',
        [username]
      )
      return !!user
    } catch (error) {
      console.error('Failed to check if user exists:', error)
      throw error
    }
  }
}