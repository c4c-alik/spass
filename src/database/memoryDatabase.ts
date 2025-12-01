import { app } from 'electron'
import path from 'path'
import Database from 'sqlite3'
import { promisify } from 'util'

// 导入 PasswordEntry 类型
import { PasswordEntry } from './index'

// 定义内部使用的密码条目类型（数据库字段）
// 用于数据库操作，将布尔类型的 isFavorited 转换为数字类型的 is_favorited
interface DatabasePasswordEntry extends Omit<PasswordEntry, 'isFavorited'> {
  is_favorited?: number
}

export class MemoryDatabase {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    // 使用内存数据库
    this.dbPath = ':memory:'
  }

  /**
   * 初始化内存数据库
   * 创建内存数据库实例并初始化所有表
   * @returns Promise<void>
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new Database.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
        } else {
          // 初始化数据库表
          this.createPasswordsTable()
            .then(() => this.createFaviconsTable())
            .then(() => resolve())
            .catch(reject)
        }
      })
    })
  }

  /**
   * 从Buffer加载数据到内存数据库
   * 将Buffer写入临时文件，然后附加该数据库并复制数据到内存数据库
   * @param buffer 包含数据库内容的Buffer
   * @returns Promise<void>
   */
  async loadFromBuffer(buffer: Buffer): Promise<void> {
    if (!this.db) {
      await this.init()
    }

    // 将Buffer写入临时文件，使用唯一文件名避免冲突
    const tempPath = path.join(
      app.getPath('temp'),
      `temp_db_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.sqlite`
    )
    const fs = await import('fs/promises')
    await fs.writeFile(tempPath, buffer)

    // 附加临时数据库并复制数据
    return new Promise((resolve, reject) => {
      this.db!.run(`ATTACH DATABASE '${tempPath}' AS temp_db`, (err) => {
        if (err) {
          reject(err)
        } else {
          // 检查源表是否有 is_favorited 字段，以确保向后兼容性
          this.db!.get(
            `
              SELECT sql
              FROM temp_db.sqlite_master
              WHERE type ='table' AND name ='passwords'
            `,
            (err, row: { sql: string } | undefined) => {
              if (err) {
                reject(err)
              } else {
                // 检查表结构是否包含 is_favorited 字段
                const hasFavoriteColumn = row && row.sql.includes('is_favorited')
                const hasGroupColumn = row && row.sql.includes('group')

                // 复制密码表数据
                this.copyPasswordsFromTempDb(hasFavoriteColumn)
                  .then(() => {
                    // 复制favicons表数据
                    return this.copyFaviconsFromTempDb()
                  })
                  .then(async () => {
                    // 删除临时文件
                    try {
                      await fs.unlink(tempPath)
                    } catch (unlinkErr) {
                      console.warn('Failed to delete temporary database file:', unlinkErr)
                    }
                    resolve()
                  })
                  .catch((err) => {
                    console.warn('Failed to copy tables:', err)
                    // 删除临时文件
                    fs.unlink(tempPath)
                      .catch(unlinkErr => console.warn('Failed to delete temporary database file:', unlinkErr))
                      .finally(() => resolve())
                  })
              }
            }
          )
        }
      })
    })
  }

  /**
   * 将内存数据库导出为Buffer
   * 使用替代方案：手动创建临时数据库并复制数据，避免使用可能不稳定的backup()方法
   * @returns 包含数据库内容的Buffer
   */
  async exportToBuffer(): Promise<Buffer> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 创建临时数据库文件，使用唯一文件名避免冲突
    const tempPath = path.join(
      app.getPath('temp'),
      `temp_export_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.sqlite`
    )
    const fs = await import('fs/promises')

    // 创建临时数据库并复制表结构和数据
    return new Promise((resolve, reject) => {
      const tempDb = new Database.Database(tempPath, (err) => {
        if (err) {
          reject(err)
        } else {
          // 在临时数据库中创建表
          this.createPasswordsTableInTempDb(tempDb)
            .then(() => this.createFaviconsTableInTempDb(tempDb))
            .then(() => {
              // 从内存数据库复制密码数据到临时数据库
              return this.exportPasswordsToTempDb(tempDb)
            })
            .then(() => {
              // 从内存数据库复制favicon数据到临时数据库
              return this.exportFaviconsToTempDb(tempDb)
            })
            .then(() => {
              tempDb.close(async () => {
                try {
                  // 读取临时数据库文件内容
                  const buffer = await fs.readFile(tempPath)
                  // 删除临时文件
                  await fs.unlink(tempPath)
                  resolve(buffer)
                } catch (readErr) {
                  reject(readErr)
                }
              })
            })
            .catch(reject)
        }
      })
    })
  }

  /**
   * 获取所有密码
   * @returns Promise<PasswordEntry[]>
   */
  async getAllPasswords(): Promise<PasswordEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      this.db!.all<DatabasePasswordEntry>(
        `SELECT id,
                service,
                username,
                password,
                url,
                "group",
                notes,
                strength,
                is_favorited as is_favorited,
                created_at,
                updated_at
         FROM passwords
         ORDER BY service`,
        (err, rows) => {
          if (err) {
            reject(err)
          } else {
            // 将 is_favorited (number) 转换为 isFavorited (boolean)
            resolve(
              rows.map((row) => ({
                ...row,
                isFavorited: row.is_favorited === 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at
              }))
            )
          }
        }
      )
    })
  }

  /**
   * 添加密码
   * @param password PasswordEntry
   * @returns Promise<number | undefined>
   */
  async addPassword(password: PasswordEntry): Promise<number | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 使用传统回调方式而非promisify，以确保能正确访问this.lastID
    return new Promise((resolve, reject) => {
      this.db!.run(
        `INSERT INTO passwords (service, username, password, url, "group", notes, strength, is_favorited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          password.service,
          password.username,
          password.password,
          password.url || null,
          password.group || 'other',
          password.notes || null,
          password.strength || 'medium',
          password.isFavorited ? 1 : 0
        ],
        function (err) {
          if (err) {
            reject(err)
          } else {
            // this.lastID包含插入记录的ID，只有在回调函数中才能正确访问
            resolve(this.lastID)
          }
        }
      )
    })
  }

  /**
   * 删除密码
   * @param id 密码ID
   * @returns Promise<number>
   */
  async deletePassword(id: number): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 使用传统回调方式而非promisify，以确保能正确访问this.changes
    return new Promise((resolve, reject) => {
      this.db!.run('DELETE FROM passwords WHERE id = ?', [id], function (err) {
        if (err) {
          reject(err)
        } else {
          // this.changes包含受影响的行数，只有在回调函数中才能正确访问
          resolve(this.changes || 0)
        }
      })
    })
  }

  /**
   * 更新密码
   * @param id 密码ID
   * @param password PasswordEntry
   * @returns Promise<number>
   */
  async updatePassword(id: number, password: PasswordEntry): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 使用传统回调方式而非promisify，以确保能正确访问this.changes
    return new Promise((resolve, reject) => {
      this.db!.run(
        `UPDATE passwords
         SET service      = ?,
             username     = ?,
             password     = ?,
             url          = ?,
             "group"      = ?,
             notes        = ?,
             strength     = ?,
             is_favorited = ?
         WHERE id = ?`,
        [
          password.service,
          password.username,
          password.password,
          password.url || null,
          password.group || 'other',
          password.notes || null,
          password.strength || 'medium',
          password.isFavorited ? 1 : 0,
          id
        ],
        function (err) {
          if (err) {
            reject(err)
          } else {
            // this.changes包含受影响的行数，只有在回调函数中才能正确访问
            resolve(this.changes || 0)
          }
        }
      )
    })
  }

  /**
   * 搜索密码
   * @param query 搜索关键词
   * @returns Promise<PasswordEntry[]>
   */
  async searchPasswords(searchTerm: string): Promise<PasswordEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      const query = `%${searchTerm}%`
      this.db!.all<DatabasePasswordEntry>(
        `SELECT id,
                service,
                username,
                password,
                url,
                "group",
                notes,
                strength,
                is_favorited as is_favorited,
                created_at,
                updated_at
         FROM passwords
         WHERE service LIKE ?
            OR username LIKE ?
         ORDER BY service`,
        [query, query],
        (err, rows) => {
          if (err) {
            reject(err)
          } else {
            // 将 is_favorited (number) 转换为 isFavorited (boolean)
            resolve(
              rows.map((row) => ({
                ...row,
                isFavorited: row.is_favorited === 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at
              }))
            )
          }
        }
      )
    })
  }

  /**
   * 切换收藏状态
   * @param id 密码ID
   * @returns Promise<void>
   */
  async toggleFavorite(id: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 先获取当前收藏状态
    const get = promisify(this.db.get).bind(this.db)
    const row: { is_favorited: number } | undefined = await get(
      'SELECT is_favorited FROM passwords WHERE id = ?',
      [id]
    )

    if (!row) {
      throw new Error('Password not found')
    }

    // 切换状态 (0->1, 1->0)
    const newFavoriteStatus = row.is_favorited === 1 ? 0 : 1

    // 更新数据库，使用传统回调方式确保能正确处理结果
    return new Promise((resolve, reject) => {
      this.db!.run(
        'UPDATE passwords SET is_favorited = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newFavoriteStatus, id],
        function (err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * 获取存储的网站favicon
   * @param url 网站URL
   * @returns Promise<string | null>
   */
  async getStoredFavicon(url: string): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!url) return null

    return new Promise((resolve, reject) => {
      this.db!.get(
        'SELECT favicon_data FROM favicons WHERE url = ?',
        [url],
        (err, row: { favicon_data: string } | undefined) => {
          if (err) {
            reject(err)
          } else {
            resolve(row ? row.favicon_data : null)
          }
        }
      )
    })
  }

  /**
   * 保存网站favicon
   * @param url 网站URL
   * @param faviconData favicon数据（base64编码）
   * @returns Promise<void>
   */
  async saveWebsiteFavicon(url: string, faviconData: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!url || !faviconData) return

    return new Promise((resolve, reject) => {
      // 使用 INSERT OR REPLACE 确保URL唯一性
      this.db!.run(
        `
          INSERT
          OR REPLACE INTO favicons (url, favicon_data, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
        [url, faviconData],
        function (err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * 获取所有favicon数据
   * @returns Promise<Array<{url: string, favicon_data: string, updated_at: string}>>
   */
  async getAllFavicons(): Promise<Array<{url: string, favicon_data: string, updated_at: string}>> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return new Promise((resolve, reject) => {
      this.db!.all(
        'SELECT url, favicon_data, updated_at FROM favicons',
        [],
        (err, rows: Array<{url: string, favicon_data: string, updated_at: string}>) => {
          if (err) {
            reject(err)
          } else {
            resolve(rows)
          }
        }
      )
    })
  }

  /**
   * 关闭数据库连接
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(err)
          } else {
            this.db = null
            resolve()
          }
        })
      })
    }
  }

  /**
   * 在临时数据库中创建密码表
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private createPasswordsTableInTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      tempDb.run(
        `
          CREATE TABLE passwords
          (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            service      TEXT NOT NULL,
            username     TEXT NOT NULL,
            password     TEXT NOT NULL,
            url          TEXT,
            "group"      TEXT     DEFAULT 'other',
            notes        TEXT,
            strength     TEXT     DEFAULT 'medium',
            is_favorited INTEGER  DEFAULT 0,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `,
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * 在临时数据库中创建网站图标表
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private createFaviconsTableInTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      tempDb.run(
        `
          CREATE TABLE favicons
          (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            url          TEXT NOT NULL UNIQUE,
            favicon_data TEXT NOT NULL,
            created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `,
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * 从临时数据库复制网站图标表数据
   * @returns Promise<void>
   */
  private copyFaviconsFromTempDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(
        `
          INSERT INTO favicons
          SELECT *
          FROM temp_db.favicons
        `,
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * 从临时数据库复制密码表数据
   * @returns Promise<void>
   */
  private copyPasswordsFromTempDb(hasFavoriteColumn: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      if (hasFavoriteColumn) {
        // 如果源表有 is_favorited 字段，直接复制所有数据
        this.db!.run(
          `
            INSERT INTO passwords
            SELECT *
            FROM temp_db.passwords
          `,
          (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )
      } else {
        // 如果源表没有 is_favorited 字段，则显式列出所有字段
        this.db!.run(
          `
            INSERT INTO passwords
            (id, service, username, password, url, "group", notes, strength, is_favorited, created_at,
             updated_at)
            SELECT id,
                   service,
                   username,
                   password,
                   url,
                   "group",
                   notes,
                   strength,
                   0,
                   created_at,
                   updated_at
            FROM temp_db.passwords
          `,
          (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          }
        )
      }
    })
  }

  /**
   * 将内存数据库中的密码数据导出到临时数据库
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private exportPasswordsToTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      // 从内存数据库复制密码数据到临时数据库
      const exportStmt = tempDb.prepare(`
        INSERT INTO passwords
        (id, service, username, password, url, "group", notes, strength, is_favorited, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      this.db!.each(
        `
          SELECT id,
                 service,
                 username,
                 password,
                 url,
                 "group",
                 notes,
                 strength,
                 is_favorited,
                 created_at,
                 updated_at
          FROM passwords
        `,
        (err, row: DatabasePasswordEntry) => {
          if (err) {
            console.error('Error reading from memory database:', err)
          } else {
            exportStmt.run(
              [
                row.id,
                row.service,
                row.username,
                row.password,
                row.url,
                row.group,
                row.notes,
                row.strength,
                row.is_favorited,
                row.created_at,
                row.updated_at
              ],
              (err) => {
                if (err) {
                  console.error('Error writing to temp database:', err)
                }
              }
            )
          }
        },
        (err) => {
          if (err) {
            reject(err)
          } else {
            exportStmt.finalize(() => resolve())
          }
        }
      )
    })
  }

  /**
   * 将内存数据库中的网站图标数据导出到临时数据库
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private exportFaviconsToTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      // 从内存数据库复制favicon数据到临时数据库
      const faviconExportStmt = tempDb.prepare(`
        INSERT INTO favicons
        (id, url, favicon_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)

      this.db!.each(
        `
          SELECT id,
                 url,
                 favicon_data,
                 created_at,
                 updated_at
          FROM favicons
        `,
        (err, row: {id: number, url: string, favicon_data: string, created_at: string, updated_at: string}) => {
          if (err) {
            console.error('Error reading favicons from memory database:', err)
          } else {
            faviconExportStmt.run(
              [
                row.id,
                row.url,
                row.favicon_data,
                row.created_at,
                row.updated_at
              ],
              (err) => {
                if (err) {
                  console.error('Error writing favicon to temp database:', err)
                }
              }
            )
          }
        },
        (err) => {
          if (err) {
            reject(err)
          } else {
            faviconExportStmt.finalize(() => resolve())
          }
        }
      )
    })
  }

  /**
   * 创建密码表
   * @returns Promise<void>
   */
  private createPasswordsTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 创建密码表，添加 is_favorited 字段用于支持收藏功能
      this.db!.run(
        `
          CREATE TABLE IF NOT EXISTS passwords
          (
            id
            INTEGER
            PRIMARY
            KEY
            AUTOINCREMENT,
            service
            TEXT
            NOT
            NULL,
            username
            TEXT
            NOT
            NULL,
            password
            TEXT
            NOT
            NULL,
            url
            TEXT,
            "group"
            TEXT
            DEFAULT
            'other',
            notes
            TEXT,
            strength
            TEXT
            DEFAULT
            'medium',
            is_favorited
            INTEGER
            DEFAULT
            0,
            created_at
            DATETIME
            DEFAULT
            CURRENT_TIMESTAMP,
            updated_at
            DATETIME
            DEFAULT
            CURRENT_TIMESTAMP
          )
        `,
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }

  /**
   * 创建网站favicon存储表
   * @returns Promise<void>
   */
  private createFaviconsTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 创建网站favicon存储表
      this.db!.run(
        `
          CREATE TABLE IF NOT EXISTS favicons
          (
            id
            INTEGER
            PRIMARY
            KEY
            AUTOINCREMENT,
            url
            TEXT
            NOT
            NULL
            UNIQUE,
            favicon_data
            TEXT
            NOT
            NULL,
            created_at
            DATETIME
            DEFAULT
            CURRENT_TIMESTAMP,
            updated_at
            DATETIME
            DEFAULT
            CURRENT_TIMESTAMP
          )
        `,
        (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        }
      )
    })
  }
}

export default MemoryDatabase
