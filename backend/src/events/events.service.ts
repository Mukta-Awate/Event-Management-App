import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventStatus, RegistrationStatus } from '../common/enums';
import { Registration } from '../registrations/registration.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './event.entity';

export type EventWithStats = Event & {
  activeRegistrations: number;
  placesRemaining: number;
};

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Registration)
    private readonly registrationsRepo: Repository<Registration>,
  ) {}

  async create(organizerId: string, dto: CreateEventDto): Promise<EventWithStats> {
    if (dto.status === EventStatus.CANCELED) {
      throw new BadRequestException('Cannot create an event as canceled');
    }

    const event = this.eventsRepo.create({
      title: dto.title.trim(),
      description: dto.description.trim(),
      startAt: new Date(dto.startAt),
      timeZone: dto.timeZone.trim(),
      venue: dto.venue.trim(),
      capacity: dto.capacity,
      status: dto.status ?? EventStatus.DRAFT,
      organizerId,
    });

    const saved = await this.eventsRepo.save(event);
    return this.withStats(saved, 0);
  }

  async findPublicUpcoming(): Promise<EventWithStats[]> {
    const now = new Date();
    const events = await this.eventsRepo
      .createQueryBuilder('event')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.startAt > :now', { now })
      .orderBy('event.startAt', 'ASC')
      .getMany();

    return this.attachStats(events);
  }

  async findPublicById(id: string): Promise<EventWithStats> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Event not found');
    }
    const active = await this.countActive(id);
    return this.withStats(event, active);
  }

  async findForOrganizer(organizerId: string): Promise<EventWithStats[]> {
    const events = await this.eventsRepo.find({
      where: { organizerId },
      order: { startAt: 'ASC' },
    });
    return this.attachStats(events);
  }

  async findOwnedById(id: string, organizerId: string): Promise<EventWithStats> {
    const event = await this.requireOwnedEvent(id, organizerId);
    const active = await this.countActive(id);
    return this.withStats(event, active);
  }

  async update(
    id: string,
    organizerId: string,
    dto: UpdateEventDto,
  ): Promise<EventWithStats> {
    const event = await this.requireOwnedEvent(id, organizerId);
    const active = await this.countActive(id);

    if (dto.capacity !== undefined && dto.capacity < active) {
      throw new BadRequestException(
        `Capacity cannot be reduced below active registrations (${active})`,
      );
    }

    if (dto.title !== undefined) event.title = dto.title.trim();
    if (dto.description !== undefined) event.description = dto.description.trim();
    if (dto.startAt !== undefined) event.startAt = new Date(dto.startAt);
    if (dto.timeZone !== undefined) event.timeZone = dto.timeZone.trim();
    if (dto.venue !== undefined) event.venue = dto.venue.trim();
    if (dto.capacity !== undefined) event.capacity = dto.capacity;
    if (dto.status !== undefined) event.status = dto.status;

    const saved = await this.eventsRepo.save(event);
    return this.withStats(saved, active);
  }

  async cancel(id: string, organizerId: string): Promise<EventWithStats> {
    return this.update(id, organizerId, { status: EventStatus.CANCELED });
  }

  async listAttendees(eventId: string, organizerId: string) {
    await this.requireOwnedEvent(eventId, organizerId);

    const registrations = await this.registrationsRepo.find({
      where: { eventId, status: RegistrationStatus.ACTIVE },
      relations: { attendee: true },
      order: { registeredAt: 'ASC' },
    });

    return registrations.map((reg) => ({
      registrationId: reg.id,
      name: reg.attendee.name,
      email: reg.attendee.email,
      registeredAt: reg.registeredAt,
    }));
  }

  async requireOwnedEvent(id: string, organizerId: string): Promise<Event> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('You can only manage your own events');
    }
    return event;
  }

  countActive(eventId: string): Promise<number> {
    return this.registrationsRepo.count({
      where: { eventId, status: RegistrationStatus.ACTIVE },
    });
  }

  private async attachStats(events: Event[]): Promise<EventWithStats[]> {
    if (!events.length) return [];
    const ids = events.map((e) => e.id);
    const rows = await this.registrationsRepo
      .createQueryBuilder('reg')
      .select('reg.eventId', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('reg.eventId IN (:...ids)', { ids })
      .andWhere('reg.status = :status', { status: RegistrationStatus.ACTIVE })
      .groupBy('reg.eventId')
      .getRawMany<{ eventId: string; count: string }>();

    const counts = new Map(rows.map((r) => [r.eventId, Number(r.count)]));
    return events.map((event) =>
      this.withStats(event, counts.get(event.id) ?? 0),
    );
  }

  private withStats(event: Event, activeRegistrations: number): EventWithStats {
    return Object.assign(event, {
      activeRegistrations,
      placesRemaining: Math.max(event.capacity - activeRegistrations, 0),
    });
  }
}
