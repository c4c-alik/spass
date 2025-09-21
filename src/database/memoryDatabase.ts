import { app } from 'electron'
import path from 'path'
import Database from 'sqlite3'
import { promisify } from 'util'

// 导入 PasswordEntry 类型
import { PasswordEntry } from './index'

// 定义数据库操作结果类型
interface DatabaseRunResult {
  lastID?: number
  changes?: number
}

export class MemoryDatabase {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    // 使用内存数据库
    this.dbPath = ':memory:'
  }

  // 初始化内存数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new Database.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
        } else {
          // 创建密码表
          this.db!.run(`
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
          `, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        }
      })
    })
  }

  // 从文件数据库加载数据到内存数据库
  async loadFromBuffer(buffer: Buffer): Promise<void> {
    if (!this.db) {
      await this.init()
    }

    // 将Buffer写入临时文件，使用唯一文件名避免冲突
    const tempPath = path.join(app.getPath('temp'), `temp_db_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.sqlite`)
    const fs = await import('fs/promises')
    await fs.writeFile(tempPath, buffer)

    // 附加临时数据库并复制数据
    return new Promise((resolve, reject) => {
      this.db!.run(`ATTACH DATABASE '${tempPath}' AS temp_db`, (err) => {
        if (err) {
          reject(err)
        } else {
          this.db!.run(`
            INSERT INTO passwords
            SELECT * FROM temp_db.passwords
          `, async (err) => {
            if (err) {
              reject(err)
            } else {
              // 删除临时文件
              try {
                await fs.unlink(tempPath)
              } catch (unlinkErr) {
                console.warn('Failed to delete temporary database file:', unlinkErr)
              }
              resolve()
            }
          })
        }
      })
    })
  }

  // 将内存数据库导出为Buffer
  async exportToBuffer(): Promise<Buffer> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 创建临时文件路径
    const tempPath = path.join(app.getPath('temp'), `temp_export_db_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.sqlite`)

    // 备份内存数据库到临时文件
    return new Promise((resolve, reject) => {
      this.db!.backup(tempPath, async (err) => {
        if (err) {
          reject(err)
          return
        }

        try {
          // 使用动态导入以避免在模块加载时出现问题
          const fs = await import('fs/promises')

          // 读取临时文件内容
          const buffer = await fs.readFile(tempPath)
          console.log('buffer', buffer)

          // 尝试删除临时文件，即使失败也不会影响主流程
          try {
            await fs.unlink(tempPath)
          } catch (unlinkErr) {
            // 如果删除失败，记录警告但不中断流程
            console.warn(`Failed to delete temporary database file: ${tempPath}`, unlinkErr)

            // 尝试在应用退出时清理
            const cleanupHandler = async (): Promise<void> => {
              try {
                // 检查文件是否存在
                try {
                  await fs.access(tempPath)
                } catch {
                  // 文件不存在，无需清理
                  app.removeListener('before-quit', cleanupHandler)
                  return
                }

                // 文件存在，尝试删除
                await fs.unlink(tempPath)
                console.log(`Successfully cleaned up temporary database file on app exit: ${tempPath}`)
                app.removeListener('before-quit', cleanupHandler)
              } catch (finalUnlinkErr) {
                // 最终清理也失败，记录日志
                console.warn(`Failed to delete temporary database file on app exit: ${tempPath}`, finalUnlinkErr)
              }
            }

            app.on('before-quit', cleanupHandler)
          }

          resolve(buffer)
        } catch (readErr) {
          reject(readErr)
        }
      })
    })
  }

  // 获取所有密码
  async getAllPasswords(): Promise<PasswordEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const all = promisify(this.db.all.bind(this.db))
      return await all(`
        SELECT id, service, username, password, url, category, notes, strength,
               datetime(created_at) as createdAt,
               datetime(updated_at) as updatedAt
        FROM passwords
        ORDER BY service
      `) as PasswordEntry[]
    } catch (error) {
      throw new Error(`Failed to get all passwords: ${(error as Error).message}`)
    }
  }

  // 添加密码
  async addPassword(password: PasswordEntry): Promise<number | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // 使用 function 回调而非箭头函数，以确保能正确访问 this.lastID
    return new Promise((resolve, reject) => {
      this.db!.run(
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
        ],
        function(err) {
          if (err) {
            reject(err)
          } else {
            // this.lastID 只在使用 function 关键字定义的回调函数中可用
            resolve(this.lastID)
          }
        }
      )
    })
  }

  // 更新密码
  async updatePassword(id: number, password: PasswordEntry): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!id) {
      throw new Error('Password ID is required for update')
    }

    const run = promisify(this.db.run.bind(this.db))
    const result: DatabaseRunResult = await run(
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
  }

  // 删除密码
  async deletePassword(id: number): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!id) {
      throw new Error('Password ID is required for deletion')
    }

    const run = promisify(this.db.run.bind(this.db))
    const result: DatabaseRunResult = await run(
      'DELETE FROM passwords WHERE id = ?',
      [id]
    )
    return result.changes || 0
  }

  // 按服务搜索密码
  async searchPasswords(query: string): Promise<PasswordEntry[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!query) {
      return await this.getAllPasswords()
    }

    const all = promisify(this.db.all.bind(this.db))
    return await all(`
      SELECT id, service, username, password, url, category, notes, strength,
             datetime(created_at) as createdAt,
             datetime(updated_at) as updatedAt
      FROM passwords
      WHERE service LIKE ? OR username LIKE ? OR url LIKE ?
      ORDER BY service
    `, [`%${query}%`, `%${query}%`, `%${query}%`]) as PasswordEntry[]
  }

  // 关闭数据库连接
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
}

export default MemoryDatabase
