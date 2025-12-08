import Database from 'sqlite3'
import { app } from 'electron'
import path from 'path'
import { DatabasePasswordEntry, PasswordsTable } from './tables/passwordsTable'
import { FaviconsTable } from './tables/faviconsTable'
import { PromisifiedDatabase, promisifyDatabase } from './utils'

export class MemoryDatabase {
  private db: Database.Database | null = null
  private promisifiedDb: PromisifiedDatabase | null = null
  private dbPath: string = ':memory:'

  constructor() {
    /* empty */
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
          return
        }

        // 创建Promise包装的数据库对象
        this.promisifiedDb = promisifyDatabase(this.db)
        if (this.promisifiedDb) {
          console.log('Database initialized')
        }

        resolve()
      })
    }).then(() => this.initTables())
  }

  /**
   * 初始化所有数据库表
   * @returns Promise<void>
   */
  private async initTables(): Promise<void> {
    // 初始化密码表
    await this.executeDDL(PasswordsTable.getDDL())

    // 初始化网站图标表
    await this.executeDDL(FaviconsTable.getDDL())

    // 如果未来需要添加更多表，可以直接在这里继续添加
    // 示例：
    // await this.executeDDL(AnotherTable.getDDL())
  }

  /**
   * 执行DDL语句
   * @param ddl DDL语句
   * @returns Promise<void>
   */
  private async executeDDL(ddl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db!.run(ddl, (err) => {
        if (err) {
          reject(err)
          return
        }

        resolve()
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
    // 将Buffer写入临时文件，使用唯一文件名避免冲突
    const tempPath = path.join(
      app.getPath('temp'),
      `temp_db_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.sqlite`
    )
    const fs = await import('fs/promises')
    await fs.writeFile(tempPath, buffer)

    return new Promise<void>((resolve, reject) => {
      this.db!.run(`ATTACH DATABASE '${tempPath}' AS temp_db`, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    }).then(async () => {
      try {
        // 直接复制密码表数据
        await this.copyPasswordsFromTempDb()

        // 复制favicons表数据
        await this.copyFaviconsFromTempDb()

        // 删除临时文件
        await this.cleanupTempFile(tempPath)
      } catch (error) {
        console.warn('Failed to copy tables:', error)
        // 删除临时文件
        await this.cleanupTempFile(tempPath)
        throw error
      }
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

    return new Promise<Buffer>((resolve, reject) => {
      const tempDb = new Database.Database(tempPath, async (err) => {
        if (err) {
          reject(err)
          return
        }

        try {
          // 在临时数据库中创建表
          await this.createPasswordsTableInTempDb(tempDb)
          await this.createFaviconsTableInTempDb(tempDb)

          // 从内存数据库复制密码数据到临时数据库
          await this.exportPasswordsToTempDb(tempDb)

          // 从内存数据库复制favicon数据到临时数据库
          await this.exportFaviconsToTempDb(tempDb)

          // 关闭临时数据库连接后再读取文件内容
          await this.closeTempDbAndReadFile(tempDb, tempPath)
            .then(resolve)
            .catch(reject)
        } catch (error) {
          // 确保即使出错也会清理临时文件
          await this.cleanupTempFile(tempPath)
          reject(error)
        }
      })
    })
  }

  /**
   * 关闭临时数据库并读取文件内容
   * @param tempDb 临时数据库连接
   * @param tempPath 临时文件路径
   * @returns 临时文件的内容
   */
  private async closeTempDbAndReadFile(
    tempDb: Database.Database,
    tempPath: string
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      tempDb.close(async (err) => {
        if (err) {
          reject(err)
          return
        }

        try {
          // 读取临时数据库文件内容
          const fs = await import('fs/promises')
          const buffer = await fs.readFile(tempPath)
          // 删除临时文件
          await fs.unlink(tempPath)
          resolve(buffer)
        } catch (readErr) {
          reject(readErr)
        }
      })
    })
  }

  /**
   * 清理临时文件
   * @param tempPath 临时文件路径
   */
  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      const fs = await import('fs/promises')
      await fs.unlink(tempPath)
    } catch (unlinkErr) {
      console.warn('Failed to delete temporary database file:', unlinkErr)
    }
  }

  /**
   * 关闭数据库连接
   * @returns Promise<void>
   */
  async close(): Promise<void> {
    if (!this.db) {
      // 如果数据库未初始化，直接返回
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) {
          reject(err)
          return
        }

        this.db = null
        this.promisifiedDb = null
        resolve()
      })
    })
  }

  /**
   * 获取Promise包装的数据库对象
   * @returns PromisifiedDatabase
   */
  getPromisifiedDb(): PromisifiedDatabase {
    if (!this.promisifiedDb) {
      throw new Error('Database not initialized')
    }

    return this.promisifiedDb
  }

  /**
   * 在临时数据库中创建密码表
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private async createPasswordsTableInTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      tempDb.run(PasswordsTable.getDDL(), (err) => {
        if (err) {
          reject(err)
          return
        }

        resolve()
      })
    })
  }

  /**
   * 在临时数据库中创建网站图标表
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private async createFaviconsTableInTempDb(tempDb: Database.Database): Promise<void> {
    return new Promise((resolve, reject) => {
      tempDb.run(FaviconsTable.getDDL(), (err) => {
        if (err) {
          reject(err)
          return
        }

        resolve()
      })
    })
  }

  /**
   * 从临时数据库复制网站图标表数据
   * @returns Promise<void>
   */
  private async copyFaviconsFromTempDb(): Promise<void> {
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
            return
          }

          resolve()
        }
      )
    })
  }

  /**
   * 从临时数据库复制密码表数据
   * @returns Promise<void>
   */
  private async copyPasswordsFromTempDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 直接复制所有数据，假设源表结构与目标表完全一致
      this.db!.run(
        `
          INSERT INTO passwords
          SELECT *
          FROM temp_db.passwords
        `,
        (err) => {
          if (err) {
            reject(err)
            return
          }

          resolve()
        }
      )
    })
  }

  /**
   * 将内存数据库中的密码数据导出到临时数据库
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private async exportPasswordsToTempDb(tempDb: Database.Database): Promise<void> {
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
            return
          }

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
        },
        (err) => {
          if (err) {
            reject(err)
            return
          }

          exportStmt.finalize(() => resolve())
        }
      )
    })
  }

  /**
   * 将内存数据库中的网站图标数据导出到临时数据库
   * @param tempDb 临时数据库连接
   * @returns Promise<void>
   */
  private async exportFaviconsToTempDb(tempDb: Database.Database): Promise<void> {
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
            return
          }

          faviconExportStmt.run(
            [row.id, row.url, row.favicon_data, row.created_at, row.updated_at],
            (err) => {
              if (err) {
                console.error('Error writing favicon to temp database:', err)
              }
            }
          )
        },
        (err) => {
          if (err) {
            reject(err)
            return
          }

          faviconExportStmt.finalize(() => resolve())
        }
      )
    })
  }
}

// 创建全局内存数据库实例
export const globalMemoryDatabase = new MemoryDatabase()

export default MemoryDatabase
