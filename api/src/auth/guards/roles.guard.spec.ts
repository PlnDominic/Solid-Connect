import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

function mockContext(user?: { roles: string[]; status: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('allows when no roles are required', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('allows matching role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['CUSTOMER']);
    expect(
      guard.canActivate(mockContext({ roles: ['CUSTOMER'], status: 'ACTIVE' })),
    ).toBe(true);
  });

  it('blocks suspended accounts', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['CUSTOMER']);
    expect(() =>
      guard.canActivate(mockContext({ roles: ['CUSTOMER'], status: 'SUSPENDED' })),
    ).toThrow(/cannot perform marketplace operations/i);
  });

  it('blocks missing role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
    expect(() =>
      guard.canActivate(mockContext({ roles: ['CUSTOMER'], status: 'ACTIVE' })),
    ).toThrow(/permission/i);
  });
});
