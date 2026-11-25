import { guestProviderPins } from '../../api/map';
import { coordsForLabel } from '../areaCoords';

jest.mock('../supabase', () => ({ supabase: {} }));

const provider = {
  id: 'provider',
  full_name: 'Ama Sample',
  initials: 'AS',
  area: 'Osu, Accra',
  photo_url: null,
  provider_category: 'Plumbing',
  provider_rating: 4.5,
  provider_jobs_count: 12,
  provider_verified: true,
  location: { lat: 8, lng: -2 },
};

it('only shows the neighbourhood, even when the directory row has exact coordinates', () => {
  expect(coordsForLabel(provider.area)).not.toBeNull();
  const [pin] = guestProviderPins([provider], null);
  expect(pin).toMatchObject({ ...coordsForLabel(provider.area), is_live: false, updated_at: null });
  expect(pin).not.toHaveProperty('location');
});

it('omits providers outside the viewport or without a known neighbourhood', () => {
  expect(guestProviderPins([provider], { minLat: 0, minLng: 0, maxLat: 1, maxLng: 1 })).toEqual([]);
  expect(guestProviderPins([{ ...provider, area: '' }], null)).toEqual([]);
});
