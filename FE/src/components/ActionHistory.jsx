import { Inbox } from 'lucide-react';
import CopyTime from './CopyTime';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ActionHistory.css';
import { useEffect, useState } from 'react';
import { useIoT } from '../context/IoTContext';
import { getActions } from '../services/apiService';

const initialFilters = { time: '', deviceId: '', action: '', status: '' };

export default function ActionHistory() {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState({ ...initialFilters, page: 1, pageSize: 10 });
  const { revision } = useIoT();
  const [result, setResult] = useState({ items: [], total: 0, page: 1, totalPages: 0 });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    getActions(filters).then(data => { if (active) { setResult(data); setError(''); } }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [filters, revision]);

  return (
    <div className="data-page">
      {error && <p role="alert" className="error-message">{error}</p>}
      <div className="table-toolbar">
        <ActionFilter values={draft} onChange={setDraft} onSearch={() => setFilters({ ...draft, time: draft.time.trim(), page: 1, pageSize: filters.pageSize })} />
        <PageSizeSelect value={filters.pageSize} onChange={(pageSize) => setFilters({ ...filters, page: 1, pageSize })} />
      </div>
      <ActionTable items={result.items} />
      <Pagination {...result} onChange={(page) => setFilters({ ...filters, page })} />
    </div>
  );
}

function ActionFilter({ values, onChange, onSearch }) {
  function update(event) { onChange({ ...values, [event.target.name]: event.target.value }); }

  return (
    <form className="filters action-filters" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
      <input type="text" name="time" value={values.time} onChange={update} placeholder="Nhập thời gian" aria-label="Thời gian thực hiện" maxLength={50} />
      <select name="deviceId" value={values.deviceId} onChange={update} aria-label="Thiết bị"><option value="">Tất cả thiết bị</option><option value="1">Led 1</option><option value="2">Led 2</option><option value="3">Led 3</option></select>
      <select name="action" value={values.action} onChange={update} aria-label="Hành động"><option value="">Tất cả hành động</option><option value="ON">ON</option><option value="OFF">OFF</option></select>
      <select name="status" value={values.status} onChange={update} aria-label="Trạng thái"><option value="">Tất cả trạng thái</option><option value="SUCCESS">SUCCESS</option><option value="LOADING">LOADING</option><option value="FAILED">FAILED</option></select>
      <button type="submit" className="search-button" >Tìm kiếm</button>
    </form>
  );
}


const statusLabels = { SUCCESS: 'SUCCESS', LOADING: 'LOADING', FAILED: 'FAILED' };

function ActionTable({ items }) {
  return (
    <div className="table-container">
      <table>
        <caption className="sr-only">Lịch sử điều khiển thiết bị</caption>
        <thead><tr><th scope="col">ID</th><th scope="col">Thiết bị</th><th scope="col">User</th><th scope="col">Hành động</th><th scope="col">Trạng thái</th><th scope="col">Thời gian</th></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}><td className="muted id-cell">{item.id}</td><td>{item.deviceName}</td><td>{item.user}</td><td>{item.action}</td><td><span className={`action-status status-${item.status.toLowerCase()}`}>{statusLabels[item.status] || item.status}</span></td><td className="muted time-cell"><CopyTime text={formatDateTime(item.time)} /></td></tr>
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
