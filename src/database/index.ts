import sqlite3 from 'sqlite3'
import { UsersTable } from './auth/usersTable'
import { PromisifiedDatabase, promisifyDatabase } from './utils'

export class DatabaseInitializer {
  private readonly dbPath: string
  private db: PromisifiedDatabase | null = null

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  // 初始化数据库
  async init(): Promise<PromisifiedDatabase> {
    if (this.db) {
      return this.db
    }

    const db = new sqlite3.Database(this.dbPath)
    this.db = promisifyDatabase(db)

    // 初始化所有表
    await this.initTables()

    console.log('Database initialized at:', this.dbPath)
    return this.db
  }

  private async initTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 初始化用户表
    await this.db.exec(UsersTable.getDDL())

    // 创建索引
    await this.createIndexes()
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 用户表索引
    await this.db.exec('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }

  static async initializeUsersDatabase(dbPath: string) {
    return await UsersTable.initialize(dbPath)
  }
}
