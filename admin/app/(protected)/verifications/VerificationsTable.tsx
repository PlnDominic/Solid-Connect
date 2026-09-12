'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { bulkReviewVerifications } from './actions';

type Row = {
  id: string;
  status: string;
  submitted_at: string;
  profiles: { full_name: string; provider_category: string | null; area: string | null } | null;
};

const stamp = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

export function VerificationsTable({ rows, status }: { rows: Row[]; status: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [result, setResult] = useState<{ error?: string; success?: boolean; count?: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const canBulk = status === 'pending';
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function runBulk(decision: 'approved' | 'rejected') {
    setResult(null);
    startTransition(async () => {
      const res = await bulkReviewVerifications([...selected], decision, reason);
      setResult(res);
      if (res.success) {
        setSelected(new Set());
        setReason('');
        setRejecting(false);
      }
    });
  }

  return (
    <>
      {canBulk && (
        <div className="table-card" style={{ padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.size} selected</span>
          <button className="btn" disabled={selected.size === 0 || pending} style={{ padding: '8px 16px' }} onClick={() => runBulk('approved')}>
            Approve selected
          </button>
          {!rejecting ? (
            <button className="filter-btn" disabled={selected.size === 0 || pending} onClick={() => setRejecting(true)}>
              Reject selected
            </button>
          ) : (
            <>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                className="search-input"
                style={{ maxWidth: 260 }}
              />
              <button className="btn reject" disabled={pending} onClick={() => runBulk('rejected')}>
                Confirm reject
              </button>
            </>
          )}
          {result?.error && <span style={{ color: 'var(--red)', fontSize: 13 }}>{result.error}</span>}
          {result?.success && <span style={{ color: 'var(--green)', fontSize: 13 }}>Updated {result.count}.</span>}
        </div>
      )}

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              {canBulk && (
                <th style={{ width: 32 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
              )}
              <th>Provider</th>
              <th>Trade</th>
              <th>Area</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {canBulk && (
                  <td>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                  </td>
                )}
                <td>
                  <Link href={`/verifications/${row.id}`}>
                    <strong>{row.profiles?.full_name ?? 'Unknown provider'}</strong>
                  </Link>
                  <br />
                  <span className="mono">{row.id.slice(0, 8)}</span>
                </td>
                <td>{row.profiles?.provider_category ?? '—'}</td>
                <td>{row.profiles?.area ?? '—'}</td>
                <td>{stamp(row.submitted_at)}</td>
                <td>
                  <span className={`pill ${row.status}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
