import fs from 'node:fs'
import path from 'node:path'

const src = path.resolve('public/.htaccess')
const dest = path.resolve('dist/.htaccess')
try {
  fs.copyFileSync(src, dest)
  console.log('Copied .htaccess → dist/.htaccess')
} catch (e) {
  console.warn('Note: could not copy .htaccess', e?.message)
}
