import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const broker = spawn(`${process.env.ProgramFiles || 'C:/Program Files'}/Mosquitto/mosquitto.exe`, ['-c', 'mosquitto.conf'], { cwd: fileURLToPath(new URL('.', import.meta.url)), stdio: 'inherit', windowsHide: true });
broker.on('error', error => { console.error('Không chạy được Mosquitto:', error.message); process.exitCode = 1; });
broker.on('exit', code => { process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => broker.kill());
