import { LEGAL_MARKDOWN } from './legalContent.generated';

export type LegalSlug = keyof typeof LEGAL_MARKDOWN;

export const LEGAL_DOCS: Record<LegalSlug, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  refunds: 'Refund & Dispute Policy',
  providers: 'Provider Agreement',
};

/**
 * The public /legal pages stay switched off (404) until LEGAL_PAGES_PUBLISHED
 * is "true". docs/legal/README.md: the drafts must not be published until a
 * lawyer qualified in Ghanaian law has approved them - flip this only then.
 */
export function legalPagesPublished(): boolean {
  return process.env.LEGAL_PAGES_PUBLISHED === 'true';
}

export function isLegalSlug(slug: string): slug is LegalSlug {
  return Object.prototype.hasOwnProperty.call(LEGAL_DOCS, slug);
}

export function legalMarkdown(slug: LegalSlug): string {
  return LEGAL_MARKDOWN[slug];
}
