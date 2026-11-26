jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventStatus, RegistrationStatus, UserRole } from '../common/enums';
import { RegistrationsService } from './registrations.service';


describe('RegistrationsService', () => {
  const attendee = {
    sub: 'attendee-1',
    email: 'attendee@example.com',
    role: UserRole.ATTENDEE,
    name: 'Alex',
  };

  function buildService(overrides: {
    event?: Record<string, unknown> | null;
    existingActive?: unknown;
    activeCount?: number;
    saveError?: unknown;
  }) {
    const registrationRepo = {
      findOne: jest.fn().mockResolvedValue(overrides.existingActive ?? null),
      count: jest.fn().mockResolvedValue(overrides.activeCount ?? 0),
      create: jest.fn((data) => ({ id: 'reg-1', ...data })),
      save: jest.fn(async (data) => {
        if (overrides.saveError) throw overrides.saveError;
        return data;
      }),
    };

    const eventRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(overrides.event),
      })),
    };

    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        if (entity.name === 'Event') return eventRepo;
        return registrationRepo;
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (cb: (m: typeof manager) => unknown) =>
        cb(manager),
      ),
    };

    const service = new RegistrationsService(
      {} as never,
      dataSource as never,
    );

    return { service, registrationRepo, eventRepo, dataSource };
  }

  const publishedEvent = {
    id: 'event-1',
    status: EventStatus.PUBLISHED,
    startAt: new Date(Date.now() + 60_000),
    capacity: 2,
  };

  it('prevents duplicate active registration for the same event', async () => {
    const { service } = buildService({
      event: publishedEvent,
      existingActive: { id: 'existing' },
    });

    await expect(service.register('event-1', attendee)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('prevents registration when event is at capacity', async () => {
    const { service } = buildService({
      event: publishedEvent,
      activeCount: 2,
    });

    await expect(service.register('event-1', attendee)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects registration for canceled events', async () => {
    const { service } = buildService({
      event: { ...publishedEvent, status: EventStatus.CANCELED },
    });

    await expect(service.register('event-1', attendee)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects registration when the event has started', async () => {
    const { service } = buildService({
      event: {
        ...publishedEvent,
        startAt: new Date(Date.now() - 60_000),
      },
    });

    await expect(service.register('event-1', attendee)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects organizers registering as attendees via role check', async () => {
    const { service } = buildService({ event: publishedEvent });
    await expect(
      service.register('event-1', {
        ...attendee,
        role: UserRole.ORGANIZER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registers successfully when a place remains', async () => {
    const { service, registrationRepo } = buildService({
      event: publishedEvent,
      activeCount: 1,
    });

    const result = await service.register('event-1', attendee);
    expect(registrationRepo.save).toHaveBeenCalled();
    expect(result.placesRemaining).toBe(0);
    expect(result.status).toBe(RegistrationStatus.ACTIVE);
  });

  it('maps unique constraint races to a conflict', async () => {
    const { service } = buildService({
      event: publishedEvent,
      activeCount: 0,
      saveError: { code: '23505' },
    });

    await expect(service.register('event-1', attendee)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
