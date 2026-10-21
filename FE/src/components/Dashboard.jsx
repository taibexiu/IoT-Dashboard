import { Thermometer, Droplet, Sun } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Zap, LoaderCircle } from 'lucide-react';
import { useIoT } from '../context/IoTContext';
import './Dashboard.css';

export default function Dashboard() {
  const { sensors, series, devices, toggleDevice, error } = useIoT();
  return (
    <div className="dashboard-page">
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="sensor-cards">
        {['temperature', 'humidity', 'light'].map(type => <SensorCard key={type} type={type} reading={sensors.find(sensor => sensor.type === type)} />)}
      </div>
      <div className="dashboard-grid">
        <SensorChart series={series} />
        <DeviceControls devices={devices} onControl={device => toggleDevice(device.id)} />
      </div>
    </div>
  );
}


const sensorStyle = {
  temperature: { name: 'Nhiệt độ', icon: Thermometer, unit: '°C', color: 'orange' },
  humidity: { name: 'Độ ẩm', icon: Droplet, unit: '%', color: 'cyan' },
  light: { name: 'Độ sáng', icon: Sun, unit: ' ADC', color: 'yellow' },
};

function SensorCard({ type, reading }) {
  const { name, icon: Icon, unit, color } = sensorStyle[type];
  const value = reading?.value === undefined || reading?.value === null ? '—' : Number(reading.value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

  return (
    <section className="sensor-card panel" aria-label={name}>
      <div className={`sensor-icon ${color}`}><Icon size={26} strokeWidth={1.7} /></div>
      <div><h2>{name}</ h2><p>{value}<span>{reading ? unit : ''}</span></p></div>
    </section>
  );
}


function timeLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
}

function SensorChart({ series }) {
  return (
    <section className="chart-panel panel">
      <div className="panel-heading">
        <h2>Biểu đồ cảm biến</h2>
        <div className="chart-legend" aria-label="Chú thích biểu đồ">
          <span><i className="legend-dot orange" />Nhiệt độ</span>
          <span><i className="legend-dot cyan" />Độ ẩm</span>
          <span><i className="legend-dot yellow" />Ánh sáng</span>
        </div>
      </div>
      <div className="sr-only">Trục trái: nhiệt độ và độ ẩm. Trục phải: ánh sáng (lux).</div>
      {series.length ? (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={series} margin={{ top: 10, right: 0, left: -18, bottom: 4 }}>
              <XAxis dataKey="time" tickFormatter={timeLabel} tick={{ fill: '#8a95a3', fontSize: 11 }} axisLine={{ stroke: '#2c343e' }} tickLine={false} minTickGap={32} dy={8} />
              <YAxis yAxisId="environment" tick={{ fill: '#8a95a3', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, (max) => Math.max(100, Math.ceil(max / 10) * 10)]} />
              <YAxis yAxisId="light" orientation="right" tick={{ fill: '#c9b65b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 'auto']} width={55} />
              <Tooltip labelFormatter={timeLabel} contentStyle={{ backgroundColor: '#171d24', border: '1px solid #34404d', borderRadius: 7, fontSize: 12 }} labelStyle={{ color: '#edf2f7', marginBottom: 7 }} />
              <Line yAxisId="environment" type="linear" dataKey="temperature" name="Nhiệt độ" unit=" °C" stroke="#ff9800" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line yAxisId="environment" type="linear" dataKey="humidity" name="Độ ẩm" unit=" %" stroke="#00c9c1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line yAxisId="light" type="linear" dataKey="light" name="Ánh sáng" unit=" ADC" stroke="#f4d300" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="state-message">Chưa nhận được dữ liệu cảm biến.</div>}
    </section>
  );
}


  function DeviceControls({ devices, onControl }) {
  return (
    <section className="devices-panel panel">
      <div className="panel-heading"><h2>Điều khiển thiết bị</h2></div>
      <div className="device-list">
        {devices.map(device => {
          const on = device.status === 'ON';
          return (
            <div key={device.id} className={`device-row ${on ? 'device-on' : ''}`}>
              <div className="device-name"><Zap size={19} /><span>{device.name}</span></div>
              <div className="device-control">
                <span className={`device-feedback ${device.error ? 'has-error' : ''}`} role="status">
                  {device.pending ? <><LoaderCircle className="device-spinner" size={14} />Loading</> : device.error ? 'Fail' : ''}
                </span>
                <button type="button" role="switch" aria-checked={on} aria-busy={device.pending} disabled={device.pending} aria-label={`${on ? 'Tắt' : 'Bật'} ${device.name}`} className={`device-switch ${on ? 'is-on' : ''}`} onClick={() => onControl(device)}><span /></button>
              </div>
              {device.error && <p className="device-error">{device.error}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
