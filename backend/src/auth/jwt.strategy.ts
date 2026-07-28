import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';
import { requireEnv } from '../config/env';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireEnv('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const result = await this.db.query<{
      id: string;
      email: string;
      role: string;
    }>(
      `
      SELECT id, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [payload.sub],
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('Session is no longer valid. Please login again.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
