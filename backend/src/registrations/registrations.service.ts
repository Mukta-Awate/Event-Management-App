import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventStatus, RegistrationStatus, UserRole } from '../common/enums';
import { Event } from '../events/event.entity';
import { JwtPayload } from '../auth/jwt-payload';
import { Registration } from './registration.entity';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectRepository(Registration)
    private readonly registrationsRepo: Repository<Registration>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async register(eventId: string, attendee: JwtPayload) {
    if (attendee.role !== UserRole.ATTENDEE) {
      throw new ForbiddenException('Only attendees can register for events');
    }

    return this.dataSource.transaction(async (manager) => {
      const event = await manager
        .getRepository(Event)
        .createQueryBuilder('event')
        .setLock('pessimistic_write')
        .where('event.id = :eventId', { eventId })
        .getOne();

      if (!event) {
        throw new NotFoundException('Event not found');
      }

      if (event.status !== EventStatus.PUBLISHED) {
        throw new BadRequestException(
          'This event is not available for registration',
        );
      }

      if (event.startAt.getTime() <= Date.now()) {
        throw new BadRequestException(
          'Registration is closed because the event has already started',
        );
      }

      const existingActive = await manager.getRepository(Registration).findOne({
        where: {
          eventId,
          attendeeId: attendee.sub,
          status: RegistrationStatus.ACTIVE,
        },
      });
      if (existingActive) {
        throw new ConflictException(
          'You already have an active registration for this event',
        );
      }

      const activeCount = await manager.getRepository(Registration).count({
        where: { eventId, status: RegistrationStatus.ACTIVE },
      });
      if (activeCount >= event.capacity) {
        throw new ConflictException('This event is full');
      }

      const registration = manager.getRepository(Registration).create({
        eventId,
        attendeeId: attendee.sub,
        status: RegistrationStatus.ACTIVE,
        canceledAt: null,
      });

      try {
        const saved = await manager.getRepository(Registration).save(registration);
        return {
          ...saved,
          placesRemaining: event.capacity - activeCount - 1,
        };
      } catch (error: unknown) {
        // Unique partial index race: two inserts for same attendee
        if (this.isUniqueViolation(error)) {
          throw new ConflictException(
            'You already have an active registration for this event',
          );
        }
        throw error;
      }
    });
  }

  async cancel(registrationId: string, user: JwtPayload) {
    const registration = await this.registrationsRepo.findOne({
      where: { id: registrationId },
      relations: { event: true },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.attendeeId !== user.sub) {
      throw new ForbiddenException('You can only cancel your own registrations');
    }

    if (registration.status === RegistrationStatus.CANCELED) {
      throw new BadRequestException('Registration is already canceled');
    }

    registration.status = RegistrationStatus.CANCELED;
    registration.canceledAt = new Date();
    return this.registrationsRepo.save(registration);
  }

  async listMine(attendeeId: string) {
    const registrations = await this.registrationsRepo.find({
      where: { attendeeId },
      relations: { event: true },
      order: { registeredAt: 'DESC' },
    });

    return registrations.map((reg) => ({
      id: reg.id,
      status: reg.status,
      registeredAt: reg.registeredAt,
      canceledAt: reg.canceledAt,
      event: {
        id: reg.event.id,
        title: reg.event.title,
        description: reg.event.description,
        startAt: reg.event.startAt,
        timeZone: reg.event.timeZone,
        venue: reg.event.venue,
        capacity: reg.event.capacity,
        status: reg.event.status,
      },
    }));
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
