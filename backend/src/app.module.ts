import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { Event } from './events/event.entity';
import { EventsModule } from './events/events.module';
import { Registration } from './registrations/registration.entity';
import { RegistrationsModule } from './registrations/registrations.module';
import { SeedModule } from './seed/seed.module';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: Number(config.get<string>('DATABASE_PORT', '5432')),
        username: config.get<string>('DATABASE_USER', 'ema'),
        password: config.get<string>('DATABASE_PASSWORD', 'ema'),
        database: config.get<string>('DATABASE_NAME', 'event_management'),
        entities: [User, Event, Registration],
        synchronize: true,
      }),
    }),
    UsersModule,
    AuthModule,
    EventsModule,
    RegistrationsModule,
    SeedModule,
  ],
})
export class AppModule {}
