'use client';

export default function VerificationsError({ error }: { error: Error & { digest?: string } }) {
  const message =
    error.message === 'already_reviewed'
      ? 'Someone else already reviewed this submission — refresh the queue to see the current status.'
      : error.message === 'not_found'
        ? 'That submission no longer exists.'
        : error.message === 'missing_reason'
          ? 'A rejection needs a reason.'
          : error.message === 'Not an admin'
            ? "That account isn't an admin."
            : 'Something went wrong loading this page.';

  return (
    <main className="mx-auto max-w-2xl p-8">
      <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
      <a href="/verifications" className="mt-4 inline-block text-sm underline">
        Back to queue
      </a>
    </main>
  );
}
