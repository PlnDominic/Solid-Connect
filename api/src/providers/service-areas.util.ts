import { BadRequestException } from '@nestjs/common';

export type ServiceAreaInput = {
  type: 'RADIUS' | 'CITY';
  lng?: number;
  lat?: number;
  radiusMeters?: number;
  cityName?: string;
};

/** Pure validation shared by unit tests and callers before RPC. */
export function assertServiceAreas(areas: ServiceAreaInput[]) {
  for (const a of areas) {
    if (a.type === 'CITY' && !a.cityName) {
      throw new BadRequestException({ code: 'CITY_REQUIRED', message: 'cityName is required.' });
    }
    if (a.type === 'RADIUS' && (a.lng == null || a.lat == null || !a.radiusMeters)) {
      throw new BadRequestException({
        code: 'RADIUS_REQUIRED',
        message: 'RADIUS areas need lng, lat, and radiusMeters.',
      });
    }
  }
}
