import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../common/enums';
import { RegistrationsService } from './registrations.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post('events/:eventId/registrations')
  @Roles(UserRole.ATTENDEE)
  register(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.register(eventId, user);
  }

  @Post('registrations/:id/cancel')
  @Roles(UserRole.ATTENDEE)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.registrationsService.cancel(id, user);
  }

  @Get('me/registrations')
  @Roles(UserRole.ATTENDEE)
  listMine(@CurrentUser() user: JwtPayload) {
    return this.registrationsService.listMine(user.sub);
  }
}
