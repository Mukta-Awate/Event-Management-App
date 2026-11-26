import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { EventStatus, UserRole } from '../common/enums';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Event) private readonly eventsRepo: Repository<Event>,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('SEED_ON_START') !== 'true') {
      return;
    }
    await this.seed();
  }

  async seed() {
    const passwordHash = await bcrypt.hash('password123', 10);

    const organizer =
      (await this.usersRepo.findOne({
        where: { email: 'organizer@example.com' },
      })) ??
      (await this.usersRepo.save(
        this.usersRepo.create({
          email: 'organizer@example.com',
          name: 'Olivia Organizer',
          role: UserRole.ORGANIZER,
          passwordHash,
        }),
      ));

    const attendee =
      (await this.usersRepo.findOne({
        where: { email: 'attendee@example.com' },
      })) ??
      (await this.usersRepo.save(
        this.usersRepo.create({
          email: 'attendee@example.com',
          name: 'Alex Attendee',
          role: UserRole.ATTENDEE,
          passwordHash,
        }),
      ));

    await this.usersRepo.findOne({ where: { email: 'attendee2@example.com' } }) ??
      (await this.usersRepo.save(
        this.usersRepo.create({
          email: 'attendee2@example.com',
          name: 'Blake Attendee',
          role: UserRole.ATTENDEE,
          passwordHash,
        }),
      ));

    const existingEvents = await this.eventsRepo.count({
      where: { organizerId: organizer.id },
    });

    if (existingEvents === 0) {
      const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const inFiveDays = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

      await this.eventsRepo.save([
        this.eventsRepo.create({
          title: 'Product Meetup',
          description:
            'An evening of lightning talks on shipping small products that matter.',
          startAt: inTwoDays,
          timeZone: 'Asia/Kolkata',
          venue: 'Innovators Hub, Bangalore',
          capacity: 3,
          status: EventStatus.PUBLISHED,
          organizerId: organizer.id,
        }),
        this.eventsRepo.create({
          title: 'Draft Workshop Ideas',
          description: 'Internal brainstorming — not ready for attendees.',
          startAt: inFiveDays,
          timeZone: 'Asia/Kolkata',
          venue: 'Studio B',
          capacity: 20,
          status: EventStatus.DRAFT,
          organizerId: organizer.id,
        }),
      ]);
    }

    this.logger.log(
      `Seed ready. Organizer ${organizer.email} / Attendee ${attendee.email} (password123)`,
    );
  }
}
