import fs from 'fs'
import path from 'path'

/**
 * Global teardown: delete temporary .lensx files from project root and downloads/.
 * Safety: only deletes files whose filename contains 'test' or 'temp'.
 */
export default async function globalTeardown() {
  const root = process.cwd()
  const downloads = path.join(root, 'downloads')
  const dirs = [root, downloads]

  const isSafeToDelete = (filename: string) => {
    const lower = filename.toLowerCase()
    return lower.includes('test') || lower.includes('temp')
  }

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) continue
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.lensx') && isSafeToDelete(e.name)) {
          const filePath = path.join(dir, e.name)
          try {
            fs.unlinkSync(filePath)
          } catch {
            // file may be gone or locked; ignore
          }
        }
      }
    } catch {
      // ignore read errors
    }
  }
}
