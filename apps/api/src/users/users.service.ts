import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(email: string, password: string): Promise<User> {
    const normalized = this.normalizeEmail(email);
    const existing = await this.users.findOne({ where: { email: normalized } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(password);
    const user = this.users.create({ email: normalized, passwordHash });
    return this.users.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
