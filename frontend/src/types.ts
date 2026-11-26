export type UserRole = 'organizer' | 'attendee';
export type EventStatus = 'draft' | 'published' | 'canceled';
export type RegistrationStatus = 'active' | 'canceled';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  startAt: string;
  timeZone: string;
  venue: string;
  capacity: number;
  status: EventStatus;
  organizerId: string;
  activeRegistrations: number;
  placesRemaining: number;
}

export interface RegistrationItem {
  id: string;
  status: RegistrationStatus;
  registeredAt: string;
  canceledAt: string | null;
  event: {
    id: string;
    title: string;
    description: string;
    startAt: string;
    timeZone: string;
    venue: string;
    capacity: number;
    status: EventStatus;
  };
}

export interface AttendeeRow {
  registrationId: string;
  name: string;
  email: string;
  registeredAt: string;
}
