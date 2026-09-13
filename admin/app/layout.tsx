import './globals.css';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import { GeistMono } from 'geist/font/mono';

// Inter is the primary UI sans-serif everywhere text isn't a mono-styled
// field (see .mono in globals.css, which keeps Geist Mono - IDs, back-link
// prefixes, filenames, other reference-code-shaped values).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = { title: 'Solid Connect Admin', description: 'Solid Connect operational administration' };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('admin-theme')?.value === 'light' ? 'light' : 'dark';

  return (
    <html data-theme={theme} className={`${inter.variable} ${GeistMono.variable}`}><body>
      {children}
    </body></html>
  );
}
