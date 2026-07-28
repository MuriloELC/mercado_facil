import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';

type DbUser = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.getOrBootstrapAdmin(dto.email, dto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const validPassword = await bcrypt.compare(dto.password, user.password_hash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    };
  }

  private async getOrBootstrapAdmin(
    email: string,
    password: string,
  ): Promise<DbUser | null> {
    const user = await this.findByEmail(email);
    if (user) {
      return user;
    }

    const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@local.dev';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin123';

    if (email !== defaultEmail || password !== defaultPassword) {
      return null;
    }

    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
    const passwordHash = await bcrypt.hash(defaultPassword, rounds);

    try {
      const result = await this.db.query<DbUser>(
        `
        INSERT INTO users (full_name, email, password_hash, role)
        VALUES ($1, $2, $3, 'admin')
        ON CONFLICT (email)
        DO UPDATE SET
          role = 'admin',
          password_hash = EXCLUDED.password_hash,
          updated_at = NOW()
        RETURNING id, full_name, email, password_hash, role
        `,
        ['Administrator', defaultEmail, passwordHash],
      );

      return result.rows[0] ?? null;
    } catch (error) {
      throw new InternalServerErrorException(
        'Unable to bootstrap default admin user. Run migrations and seed scripts.',
      );
    }
  }

  private async findByEmail(email: string): Promise<DbUser | null> {
    const result = await this.db.query<DbUser>(
      `
      SELECT id, full_name, email, password_hash, role
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  }
}
