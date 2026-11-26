jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
}));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus } from '../common/enums';
import { EventsService } from './events.service';


describe('EventsService ownership and capacity rules', () => {
  function buildService(event: Record<string, unknown> | null, active = 0) {
    const eventsRepo = {
      findOne: jest.fn().mockResolvedValue(event),
      save: jest.fn(async (e) => e),
      create: jest.fn((data) => data),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const registrationsRepo = {
      count: jest.fn().mockResolvedValue(active),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const service = new EventsService(
      eventsRepo as never,
      registrationsRepo as never,
    );
    return { service, eventsRepo, registrationsRepo };
  }

  it('blocks another organizer from managing an event', async () => {
    const { service } = buildService({
      id: 'event-1',
      organizerId: 'org-a',
      capacity: 10,
      status: EventStatus.PUBLISHED,
    });

    await expect(
      service.findOwnedById('event-1', 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks another organizer from viewing attendee lists', async () => {
    const { service } = buildService({
      id: 'event-1',
      organizerId: 'org-a',
      capacity: 10,
      status: EventStatus.PUBLISHED,
    });

    await expect(
      service.listAttendees('event-1', 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents reducing capacity below active registrations', async () => {
    const { service } = buildService(
      {
        id: 'event-1',
        organizerId: 'org-a',
        capacity: 5,
        status: EventStatus.PUBLISHED,
        title: 'Meetup',
        description: 'x',
        startAt: new Date(),
        timeZone: 'UTC',
        venue: 'Hall',
      },
      3,
    );

    await expect(
      service.update('event-1', 'org-a', { capacity: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('hides non-published events from the public detail endpoint', async () => {
    const { service } = buildService({
      id: 'event-1',
      organizerId: 'org-a',
      status: EventStatus.DRAFT,
      capacity: 5,
    });

    await expect(service.findPublicById('event-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
