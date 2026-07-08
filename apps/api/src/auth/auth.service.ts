import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthResponse } from '@idle/shared';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.create(email, password);
    return this.buildResponse(user);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.users.verifyPassword(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildResponse(user);
  }

  private buildResponse(user: User): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email },
    };
  }
}
