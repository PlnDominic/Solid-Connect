import './globals.css';
import { cookies } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('admin-theme')?.value === 'light' ? 'light' : 'dark';

  return (
    <html data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`}><body>
      {children}
    </body></html>
  );
}
