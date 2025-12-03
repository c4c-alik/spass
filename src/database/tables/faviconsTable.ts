import sqlite3 from 'sqlite3'
import { promisifyDatabase, PromisifiedDatabase } from '../utils'
import { globalMemoryDatabase } from '../memoryDatabase'

export class FaviconsTable {
  static getDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS favicons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        favicon_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `
  }

  static async initialize(dbPath: string): Promise<PromisifiedDatabase> {
    const db = new sqlite3.Database(dbPath)
    const promisifiedDb = promisifyDatabase(db)

    // 创建网站图标表
    await promisifiedDb.exec(this.getDDL())

    return promisifiedDb
  }

  static async getStoredFavicon(url: string): Promise<string | null> {
    if (!url) return null

    try {
      const db = globalMemoryDatabase.getPromisifiedDb();
      const row: { favicon_data: string } | undefined = await db.get(
        'SELECT favicon_data FROM favicons WHERE url = ?',
        [url]
      )
      return row ? row.favicon_data : null
    } catch (error) {
      console.error('Failed to get stored favicon:', error)
      throw error
    }
  }

  static async saveWebsiteFavicon(
    url: string,
    faviconData: string
  ): Promise<void> {
    if (!url || !faviconData) return

    try {
      const db = globalMemoryDatabase.getPromisifiedDb();
      // 使用 INSERT OR REPLACE 确保URL唯一性
      await db.run(
        `
          INSERT OR REPLACE INTO favicons (url, favicon_data, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
        [url, faviconData]
      )
    } catch (error) {
      console.error('Failed to save website favicon:', error)
      throw error
    }
  }

  static async getAllFavicons(): Promise<Array<{ url: string; favicon_data: string; updated_at: string }>> {
    try {
      const db = globalMemoryDatabase.getPromisifiedDb();
      return await db.all('SELECT url, favicon_data, updated_at FROM favicons', [])
    } catch (error) {
      console.error('Failed to get all favicons:', error)
      throw error
    }
  }
}
