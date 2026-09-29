import { disputeTimeline, disputeAccess, evidencePath, MAX_EVIDENCE_PER_PARTY } from '../disputeCase';
import type { Dispute } from '../../types/database';

const base: Dispute = {
  id: 'd1',
  job_id: 'j1',
  customer_id: 'cust',
  provider_id: 'prov',
  reason: 'poor_quality',
  description: 'Leak again',
  status: 'open',
  resolution_note: null,
  resolved_at: null,
  created_at: '2030-01-01T10:00:00Z',
  provider_response: null,
  provider_responded_at: null,
  payment_already_released: false,
};

describe('disputeTimeline', () => {
  it('starts with only "filed" done', () => {
    const t = disputeTimeline(base);
    expect(t.map((s) => [s.key, s.done])).toEqual([['filed', true], ['response', false], ['resolved', false]]);
  });

  it('marks the provider response and resolution as they happen', () => {
    const t = disputeTimeline({
      ...base,
      provider_responded_at: '2030-01-01T12:00:00Z',
      status: 'resolved',
      resolved_at: '2030-01-02T09:00:00Z',
    });
    expect(t.every((s) => s.done)).toBe(true);
    expect(t[1].at).toBe('2030-01-01T12:00:00Z');
    expect(t[2].at).toBe('2030-01-02T09:00:00Z');
  });
});

describe('disputeAccess', () => {
  it('lets the provider respond once, while open', () => {
    expect(disputeAccess(base, 'prov', 0).canRespond).toBe(true);
    expect(disputeAccess({ ...base, provider_responded_at: 'x' }, 'prov', 0).canRespond).toBe(false);
    expect(disputeAccess({ ...base, status: 'resolved' }, 'prov', 0).canRespond).toBe(false);
  });

  it('never lets the customer respond', () => {
    expect(disputeAccess(base, 'cust', 0).canRespond).toBe(false);
  });

  it('lets either party add evidence up to the limit while open', () => {
    expect(disputeAccess(base, 'cust', 0)).toMatchObject({ canAddEvidence: true, evidenceLeft: MAX_EVIDENCE_PER_PARTY });
    expect(disputeAccess(base, 'prov', 3)).toMatchObject({ canAddEvidence: true, evidenceLeft: MAX_EVIDENCE_PER_PARTY - 3 });
    expect(disputeAccess(base, 'cust', MAX_EVIDENCE_PER_PARTY)).toMatchObject({ canAddEvidence: false, evidenceLeft: 0 });
  });

  it('locks evidence once resolved, and for outsiders', () => {
    expect(disputeAccess({ ...base, status: 'resolved' }, 'cust', 0).canAddEvidence).toBe(false);
    expect(disputeAccess(base, 'someone-else', 0)).toMatchObject({ canAddEvidence: false, canRespond: false });
  });
});

describe('evidencePath', () => {
  it('follows <dispute>/<author>/<file> so the storage policy can check both', () => {
    expect(evidencePath('d1', 'u1', 1700000000000, 2)).toBe('d1/u1/1700000000000-2.jpg');
  });
});
