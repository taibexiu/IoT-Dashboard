import 'dotenv/config';

export function readConfig(env = process.env) {
  const config = {
    host: env.HOST || '127.0.0.1', port: Number(env.PORT || 5000),
    origins: (env.FRONTEND_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173').split(',').map(value => value.trim()),
    mode: env.DATA_MODE || 'sql', secret: env.JWT_SECRET || '', deviceKey: env.DEVICE_API_KEY || '',
    mqtt: { url: env.MQTT_URL || 'mqtt://localhost:1111', username: env.MQTT_USER, password: env.MQTT_PASSWORD, timeout: Number(env.MQTT_TIMEOUT_MS || 8000) },
    database: {
      server: env.DB_SERVER || 'localhost', port: Number(env.DB_PORT || 1433), database: env.DB_NAME || 'IoTDashboard',
      user: env.DB_USER, password: env.DB_PASSWORD,
      options: { encrypt: env.DB_ENCRYPT === 'true', trustServerCertificate: env.DB_TRUST_CERTIFICATE === 'true', useUTC: true,
        ...(env.DB_INSTANCE ? { instanceName: env.DB_INSTANCE } : {}) },
    },
  };
  if (!['sql', 'demo'].includes(config.mode)) throw new Error('DATA_MODE phải là sql hoặc demo.');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT không hợp lệ.');
  if (config.secret.length < 32 || config.secret.startsWith('replace-')) throw new Error('Hãy đặt JWT_SECRET riêng, ít nhất 32 ký tự trong BE/.env.');
  if (config.deviceKey.length < 24 || config.deviceKey.startsWith('replace-')) throw new Error('Hãy đặt DEVICE_API_KEY riêng, ít nhất 24 ký tự trong BE/.env.');
  return config;
}
