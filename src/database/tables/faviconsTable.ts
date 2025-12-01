import sqlite3 from 'sqlite3'

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
        db.all(sql, params || [], (err, rows: T[]) => {
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
        db.get(sql, params || [], (err, row: T | undefined) => {
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

  static async getStoredFavicon(db: any, url: string): Promise<string | null> {
    if (!url) return null

    try {
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

  static async saveWebsiteFavicon(db: any, url: string, faviconData: string): Promise<void> {
    if (!url || !faviconData) return

    try {
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

  static async getAllFavicons(db: any): Promise<Array<{url: string, favicon_data: string, updated_at: string}>> {
    try {
      return await db.all(
        'SELECT url, favicon_data, updated_at FROM favicons',
        []
      )
    } catch (error) {
      console.error('Failed to get all favicons:', error)
      throw error
    }
  }
}