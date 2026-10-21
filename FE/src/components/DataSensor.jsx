import { Inbox } from 'lucide-react';
import CopyTime from './CopyTime';
import { Search } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './DataSensor.css';
import { useEffect, useState } from 'react';
import { useIoT } from '../context/IoTContext';
import { getSensors } from '../services/apiService';

const initialFilters = { keyword: '', type: 'all' };

export default function DataSensor() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState({ ...initialFilters, page: 1, pageSize: 10 });
  const { revision } = useIoT();
  const [result, setResult] = useState({ items: [], total: 0, page: 1, totalPages: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getSensors(filters).then(data => { if (active) { setResult(data); setError(''); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [filters, revision]);

  return (
    <div className="data-page">
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="table-toolbar">
        <SensorFilter values={draft} onChange={setDraft} onSearch={() => setFilters({ ...draft, keyword: draft.keyword.trim(), page: 1, pageSize: filters.pageSize })} />
        <PageSizeSelect value={filters.pageSize} onChange={(pageSize) => setFilters({ ...filters, page: 1, pageSize })} />
      </div>
      <SensorTable items={result.items} />
      <Pagination {...result} onChange={(page) => setFilters({ ...filters, page })} />
    </div>
  );
}


function SensorFilter({ values, onChange, onSearch }) {
  function update(event) { onChange({ ...values, [event.target.name]: event.target.value }); }

  return (
    <form className="filters sensor-filters" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
      <div className="search-field"><Search size={19} /><input type="text" name="keyword" value={values.keyword} onChange={update} placeholder="Nhập giá trị tìm kiếm" aria-label="Giá trị cảm biến cần tìm" inputMode={values.type === 'time' ? 'text' : 'decimal'} maxLength={50} /></div>
      <select name="type" value={values.type} onChange={update} aria-label="Loại cảm biến">
        <option value="all">Tất cả</option><option value="temperature">Nhiệt độ</option><option value="humidity">Độ ẩm</option><option value="light">Độ sáng</option><option value="time">Thời gian</option>
      </select>
      <button type="submit" className="search-button" >Tìm kiếm</button>
    </form>
  );
}


const sensorNames = { temperature: 'Nhiệt độ', humidity: 'Độ ẩm', light: 'Độ sáng' };

function SensorTable({ items }) {
  return (
    <div className="table-container">
      <table>
        <caption className="sr-only">Dữ liệu cảm biến theo thời gian</caption>
        <thead><tr><th scope="col">ID</th><th scope="col">Sensor</th><th scope="col">Giá trị</th><th scope="col">Thời gian</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}><td className="muted id-cell">{item.id}</td><td>{sensorNames[item.type] || item.sensorName}</td><td className="sensor-value">{Number(item.value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}{item.unit === 'lux' ? ' ' : ''}{item.unit}</td><td className="muted time-cell"><CopyTime text={formatDateTime(item.datetime)} /></td></tr>
          ))}
        </tbody>
      </table>
      {!items.length && <EmptyState />}
    </div>
  );
}

function PageSizeSelect({ value, onChange }) {
  return (
    <label className="page-size-control">
      <span>Hiển thị</span>
      <select aria-label="Số bản ghi mỗi trang" value={value}  onChange={(event) => onChange(Number(event.target.value))}>
        <option value={10}>10 bản ghi</option>
        <option value={20}>20 bản ghi</option>
      </select>
      <span>/ trang</span>
    </label>
  );
}


function Pagination({ page, totalPages, total, onChange }) {
  if (!total) return null;
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => firstPage + index);

  return (
    <div className="pagination-bar">
      <nav className="pagination" aria-label="Phân trang">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước"><ChevronLeft size={16} /></button>
        {firstPage > 1 && <span>…</span>}
        {pages.map((number) => (
          <button key={number} className={number === page ? 'current' : ''} aria-current={number === page ? 'page' : undefined} aria-label={`Trang ${number}`}  onClick={() => onChange(number)}>{number}</button>
        ))}
        {firstPage + pages.length - 1 < totalPages && <span>…</span>}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Trang sau"><ChevronRight size={16} /></button>
      </nav>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="state-message empty-state">
      <Inbox size={30} strokeWidth={1.5} />
      <strong>Không có dữ liệu phù hợp</strong>
      <span>Thử thay đổi điều kiện tìm kiếm hoặc xóa bộ lọc.</span>
    </div>
  );
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  // Giờ Việt Nam UTC+7, định dạng giống bảng trong thiết kế.
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}
