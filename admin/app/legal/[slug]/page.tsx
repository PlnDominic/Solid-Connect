import { notFound } from 'next/navigation';
import { marked } from 'marked';
import { LEGAL_DOCS, isLegalSlug, legalMarkdown, legalPagesPublished } from '../../../lib/legal';
import '../legal.css';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: isLegalSlug(slug) ? `${LEGAL_DOCS[slug]} · Solid Connect` : 'Solid Connect' };
}

/** A public legal document (linked from the app and the stores), rendered
 * from docs/legal. Readable signed out - see the middleware matcher. */
export default async function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!legalPagesPublished() || !isLegalSlug(slug)) notFound();
  // Trusted source: our own committed markdown, not user input.
  const html = await marked.parse(legalMarkdown(slug));
  return (
    <main className="legal-page">
      <nav className="legal-nav" aria-label="Legal documents">
        <a href="/legal" className="legal-home"><img src="/logo.jpeg" alt="" width={28} height={28} />Solid Connect</a>
        {Object.entries(LEGAL_DOCS).map(([key, title]) => (
          <a key={key} href={`/legal/${key}`} aria-current={key === slug ? 'page' : undefined}>{title}</a>
        ))}
      </nav>
      <article className="legal-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
