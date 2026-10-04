import { notFound } from 'next/navigation';
import { LEGAL_DOCS, legalPagesPublished } from '../../lib/legal';
import './legal.css';

export const metadata = { title: 'Legal · Solid Connect' };

export default function LegalIndexPage() {
  if (!legalPagesPublished()) notFound();
  return (
    <main className="legal-page">
      <article className="legal-doc">
        <h1>Solid Connect legal</h1>
        <ul className="legal-list">
          {Object.entries(LEGAL_DOCS).map(([slug, title]) => (
            <li key={slug}><a href={`/legal/${slug}`}>{title}</a></li>
          ))}
        </ul>
      </article>
    </main>
  );
}
