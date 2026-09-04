import { signInAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form action={signInAction} className="w-full max-w-sm rounded border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold">Solid Connect Admin</h1>
        {error ? (
          <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === 'not_admin' ? 'That account is not an admin.' : error}
          </p>
        ) : null}
        <label className="mb-1 block text-sm text-gray-600">Email</label>
        <input name="email" type="email" required className="mb-4 w-full rounded border p-2" />
        <label className="mb-1 block text-sm text-gray-600">Password</label>
        <input name="password" type="password" required className="mb-6 w-full rounded border p-2" />
        <button type="submit" className="w-full rounded bg-gray-900 py-2 text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
