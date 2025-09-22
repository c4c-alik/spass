import { app } from 'electron'
import path from 'path'
import Database from 'sqlite3'
import { promisify } from 'util'

// 导入 PasswordEntry 类型
import { PasswordEntry } from './index'

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

    console.log('Exporting memory database to buffer using alternative method')
    
    // 创建临时文件路径
    const tempPath = path.join(app.getPath('temp'), `temp_export_db_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.sqlite`)
    console.log('Exporting to temporary file:', tempPath)

    try {
      // 创建一个新的磁盘数据库
      const diskDb = new Database.Database(tempPath)
      
      // 等待数据库连接完成
      await new Promise<void>((resolve, reject) => {
        diskDb.on('open', () => resolve())
        diskDb.on('error', reject)
      })

      // 在磁盘数据库中创建表结构
      const diskExec = promisify(diskDb.exec.bind(diskDb))
      await diskExec(`
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
      
      // 从内存数据库中获取所有密码数据
      const all = promisify(this.db.all.bind(this.db))
      const passwords = await all('SELECT * FROM passwords')
      console.log('Found', passwords.length, 'passwords to export')
      
      // 如果有数据，则逐条插入到磁盘数据库
      if (passwords.length > 0) {
        const diskRun = promisify(diskDb.run.bind(diskDb))
        
        // 开始事务以提高性能
        await diskRun('BEGIN TRANSACTION')
        
        try {
          // 逐条插入数据
          for (const password of passwords) {
            await diskRun(`
              INSERT INTO passwords (id, service, username, password, url, category, notes, strength, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              password.id,
              password.service,
              password.username,
              password.password,
              password.url,
              password.category,
              password.notes,
              password.strength,
              password.created_at,
              password.updated_at
            ])
          }
          
          // 提交事务
          await diskRun('COMMIT')
          console.log('Successfully inserted all passwords into disk database')
        } catch (error) {
          // 回滚事务
          await diskRun('ROLLBACK')
          throw error
        }
      }
      
      // 关闭磁盘数据库连接
      const diskClose = promisify(diskDb.close.bind(diskDb))
      await diskClose()
      
      // 读取临时文件内容并返回Buffer
      const fs = await import('fs/promises')
      const buffer = await fs.readFile(tempPath)
      console.log('Read temporary file, size:', buffer.length, 'bytes')
      
      // 删除临时文件
      try {
        await fs.unlink(tempPath)
        console.log('Successfully deleted temporary file:', tempPath)
      } catch (unlinkErr) {
        console.warn(`Failed to delete temporary database file: ${tempPath}`, unlinkErr)
      }
      
      return buffer
    } catch (error) {
      // 确保在出错时也尝试删除临时文件
      try {
        const fs = await import('fs/promises')
        await fs.unlink(tempPath)
      } catch (unlinkErr) {
        console.warn(`Failed to delete temporary database file: ${tempPath}`, unlinkErr)
      }
      
      console.error('Failed to export database using alternative method:', error)
      throw error
    }
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

    return new Promise((resolve, reject) => {
      // 不使用 promisify，直接使用回调函数以确保能正确访问 this.changes
      this.db!.run(
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
        ],
        function (err) {
          if (err) {
            reject(err)
          } else {
            // this.changes 只在使用 function 关键字定义的回调函数中可用
            resolve(this.changes || 0)
          }
        }
      )
    })
  }

  // 删除密码
  async deletePassword(id: number): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    if (!id) {
      throw new Error('Password ID is required for deletion')
    }

    return new Promise((resolve, reject) => {
      // 不使用 promisify，直接使用回调函数以确保能正确访问 this.changes
      this.db!.run(
        'DELETE FROM passwords WHERE id = ?',
        [id],
        function (err) {
          if (err) {
            reject(err)
          } else {
            // this.changes 只在使用 function 关键字定义的回调函数中可用
            resolve(this.changes || 0)
          }
        }
      )
    })
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