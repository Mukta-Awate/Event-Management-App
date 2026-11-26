import { UserRole } from '../common/enums';

export class JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
}
