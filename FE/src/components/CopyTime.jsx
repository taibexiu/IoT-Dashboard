import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyTime({ text }) {
  const [status, setStatus] = useState('');
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Đã sao chép');
    } catch {
      setStatus('Không thể sao chép');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 2000);
  }

  return (
    <span className="copy-time">
      <span>{text}</span>
      <button type="button" className="copy-time-button" onClick={copy} aria-label={`Sao chép thời gian ${text}`} title={status || 'Sao chép thời gian'}>
        {status === 'Đã sao chép' ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <span className="sr-only" role="status">{status}</span>
    </span>
  );
}
