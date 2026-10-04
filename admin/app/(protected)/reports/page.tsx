import Link from 'next/link';
import { createServerSupabase } from '../../../lib/supabase';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Pagination, PAGE_SIZE, parsePage, clampPage } from '../../components/Pagination';
import { resolveReport } from './actions';

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

const STATUSES = ['open', 'actioned', 'dismissed'] as const;

const REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment or abuse',
  scam_or_fraud: 'Scam or fraud',
  inappropriate_content: 'Inappropriate content',
  unsafe_behavior: 'Unsafe behaviour',
  fake_profile: 'Fake profile',
  other: 'Something else',
  contact_sharing: 'Shared contact details',
};

const stamp = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));

type Person = { id: string; full_name: string; role: string };

export default async function ReportsPage({ searchParams }: Props) {
  const { status: requested, page: pageRaw } = await searchParams;
  const status = (STATUSES as readonly string[]).includes(requested ?? '') ? requested! : 'open';
  const requestedPage = parsePage(pageRaw);
  const supabase = await createServerSupabase();

  const { count, error: countError } = await supabase
    .from('user_reports')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);
  const total = count ?? 0;
  const page = clampPage(requestedPage, total, PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE;

  const { data: reports, error: listError } = await supabase
    .from('user_reports')
    .select('id, reporter_id, reported_id, context, job_id, thread_id, reason, details, status, admin_note, created_at')
    .eq('status', status)
    .order('created_at', { ascending: status !== 'open' ? false : true })
    .range(from, from + PAGE_SIZE - 1);
  const rows = reports ?? [];

  // reporter_id is null for automatic flags (contact details in chat, 0071).
  const personIds = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_id]).filter(Boolean))] as string[];
  const threadIds = [...new Set(rows.map((r) => r.thread_id).filter(Boolean))] as string[];

  const [{ data: people, error: peopleError }, { data: messages, error: messagesError }] = await Promise.all([
    personIds.length
      ? supabase.from('profiles').select('id, full_name, role').in('id', personIds)
      : Promise.resolve({ data: [] as Person[], error: null }),
    threadIds.length
      ? supabase
          .from('chat_messages')
          .select('thread_id, sender_id, text, image_url, created_at')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as { thread_id: string; sender_id: string; text: string | null; image_url: string | null; created_at: string }[], error: null }),
  ]);

  const peopleMap: Record<string, Person> = {};
  (people ?? []).forEach((p) => (peopleMap[p.id] = p));
  const messagesByThread: Record<string, NonNullable<typeof messages>> = {};
  (messages ?? []).forEach((m) => {
    (messagesByThread[m.thread_id] ??= []).push(m);
  });

  const profileHref = (p?: Person) => (p ? (p.role === 'provider' ? `/providers/${p.id}` : `/customers/${p.id}`) : '#');

  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Trust &amp; safety</div>
        <h1>User reports</h1>
        <p className="page-header-sub">
          Reports filed from chats, provider profiles and jobs, plus automatic flags when someone tries to share a phone
          number or account details in chat. To act on a report, open the reported person and suspend
          the account if needed, then close the report here with a note.
        </p>
      </div>

      <ErrorBanner errors={[countError?.message, listError?.message, peopleError?.message, messagesError?.message]} />

      <nav className="tabs" style={{ margin: '0 0 14px' }}>
        {STATUSES.map((s) => (
          <Link key={s} href={`/reports?status=${s}`} className={status === s ? 'selected' : ''}>
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="empty">No {status} reports.</div>
      ) : (
        <div className="stack-10">
          {rows.map((r) => {
            const reporter = r.reporter_id ? peopleMap[r.reporter_id] : undefined;
            const automatic = !r.reporter_id;
            const reported = peopleMap[r.reported_id];
            const thread = (messagesByThread[r.thread_id ?? ''] ?? []).slice(0, 10).reverse();
            return (
              <div key={r.id} className="panel">
                <div className="toolbar" style={{ marginBottom: 8 }}>
                  <div>
                    <span className="pill rejected">{REASON_LABELS[r.reason] ?? r.reason}</span>{' '}
                    <span className="text-muted-sm">
                      {r.context} report · {stamp(r.created_at)}
                    </span>
                  </div>
                  {r.job_id ? (
                    <Link className="link-accent" href={`/jobs/${r.job_id}`}>
                      View job
                    </Link>
                  ) : null}
                </div>
                <p className="text-muted-md" style={{ margin: 0 }}>
                  {automatic ? (
                    <>
                      <strong>Automatic flag</strong> on{' '}
                      <Link className="link-accent" href={profileHref(reported)}>
                        {reported?.full_name ?? 'a user'}
                      </Link>{' '}
                      - the message was blocked or stripped before the other person saw it
                    </>
                  ) : (
                    <>
                      <strong>{reporter?.full_name ?? 'Someone'}</strong> reported{' '}
                      <Link className="link-accent" href={profileHref(reported)}>
                        {reported?.full_name ?? 'a user'}
                      </Link>
                    </>
                  )}
                </p>
                {r.details ? <p style={{ margin: '8px 0 0', fontSize: 'var(--fs-sm)' }}>{r.details}</p> : null}

                {thread.length > 0 ? (
                  <details style={{ marginTop: 10 }}>
                    <summary className="text-muted-md" style={{ cursor: 'pointer' }}>
                      Recent messages in this chat ({thread.length})
                    </summary>
                    <div className="stack-10" style={{ marginTop: 8 }}>
                      {thread.map((m, i) => (
                        <div key={i} style={{ fontSize: 'var(--fs-sm)' }}>
                          <span className="text-muted-sm">
                            {peopleMap[m.sender_id]?.full_name ?? (m.sender_id === r.reported_id ? 'Reported person' : 'Reporter')} ·{' '}
                            {stamp(m.created_at)}
                          </span>
                          <div>{m.text || (m.image_url ? '[photo]' : '')}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}

                {r.status === 'open' ? (
                  <form className="mt-20" style={{ display: 'grid', gap: 8 }}>
                    <input name="note" className="search-input" placeholder="Note for the record (optional)" maxLength={500} />
                    <div className="flex-gap-8">
                      <button className="filter-btn" formAction={resolveReport.bind(null, r.id, 'actioned')}>
                        Mark as actioned
                      </button>
                      <button className="filter-btn" formAction={resolveReport.bind(null, r.id, 'dismissed')}>
                        Dismiss
                      </button>
                    </div>
                  </form>
                ) : r.admin_note ? (
                  <p className="text-muted-md mt-20">Note: {r.admin_note}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/reports" params={{ status }} />
    </>
  );
}
