import { Database } from 'sqlite3'

// 定义数据库操作结果类型
export interface DatabaseRunResult {
  lastID?: number
  changes?: number
}

// 将 sqlite3 转换为 Promise 形式
export const promisifyDatabase = (db: Database) => {
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

export type PromisifiedDatabase = ReturnType<typeof promisifyDatabase>