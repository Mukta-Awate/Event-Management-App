import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RegistrationStatus } from '../common/enums';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';

@Entity('registrations')
@Index('UQ_active_registration_per_event_attendee', ['eventId', 'attendeeId'], {
  unique: true,
  where: `"status" = 'active'`,
})
export class Registration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  attendeeId: string;

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.ACTIVE,
  })
  status: RegistrationStatus;

  @ManyToOne(() => Event, (event) => event.registrations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @ManyToOne(() => User, (user) => user.registrations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attendeeId' })
  attendee: User;

  @CreateDateColumn({ type: 'timestamptz' })
  registeredAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  canceledAt: Date | null;
}
