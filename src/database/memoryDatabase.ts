import Database from 'sqlite3'
import { app } from 'electron'
import path from 'path'
import { PasswordsTable } from './tables/passwordsTable'
import { FaviconsTable } from './tables/faviconsTable'
import { promisifyDatabase, PromisifiedDatabase } from './utils'

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
          this.db!.exec(PasswordsTable.getDDL(), (err) => {
            if (err) {
              reject(err)
            } else {
              this.db!.exec(FaviconsTable.getDDL(), (err) => {
                if (err) {
                  reject(err)
                } else {
                  resolve()
                }
              })
            }
          })
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
                      .catch((unlinkErr) =>
                        console.warn('Failed to delete temporary database file:', unlinkErr)
                      )
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
   * 获取Promise包装的数据库对象
   * @returns PromisifiedDatabase
   */
  getPromisifiedDb(): PromisifiedDatabase {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return promisifyDatabase(this.db)
  }

  /**
   * 在临时数据库中创建密码表
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private createPasswordsTableInTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      tempDb.run(PasswordsTable.getDDL(), (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * 在临时数据库中创建网站图标表
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private createFaviconsTableInTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      tempDb.run(FaviconsTable.getDDL(), (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
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
        (
          err,
          row: {
            id: number
            url: string
            favicon_data: string
            created_at: string
            updated_at: string
          }
        ) => {
          if (err) {
            console.error('Error reading favicons from memory database:', err)
          } else {
            faviconExportStmt.run(
              [row.id, row.url, row.favicon_data, row.created_at, row.updated_at],
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
}

// 创建全局内存数据库实例
export const globalMemoryDatabase = new MemoryDatabase()

export default MemoryDatabase
export type { PasswordEntry }
