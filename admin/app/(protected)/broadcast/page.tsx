import { BroadcastForm } from './BroadcastForm';

export const dynamic = 'force-dynamic';

export default function BroadcastPage() {
  return (
    <>
      <div className="page-header">
        <div className="page-header-eyebrow">Content</div>
        <h1>Broadcast</h1>
        <p className="page-header-sub">Send an announcement to every customer, every provider, or everyone.</p>
      </div>

      <div className="empty" style={{ textAlign: 'left', marginBottom: 16, padding: 16 }}>
        This writes a real notification row for each recipient - it does not push a phone notification yet
        (that needs an EAS project linked to the mobile app first). Right now, nobody has an in-app inbox that
        shows these either; this is the sending side, ready for whenever that screen exists.
      </div>

      <BroadcastForm />
    </>
  );
}
