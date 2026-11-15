import { spawn } from 'node:child_process'
import process from 'node:process'

const children = [
  spawn(process.execPath, ['server/index.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.platform === 'win32' ? 'node_modules/.bin/vite.cmd' : 'node_modules/.bin/vite', [], { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }),
]
let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const child of children) child.on('exit', code => {
  if (!stopping && code !== 0) {
    stop()
    process.exitCode = code ?? 1
  }
})
