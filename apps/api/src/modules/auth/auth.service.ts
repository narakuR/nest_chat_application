import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Avatar } from './avatar.entity';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Avatar)
        private avatarRepository: Repository<Avatar>,
        private jwtService: JwtService,
    ) {
    }

    async signin(dto: LoginDto) {
        const user = await this.userRepository.findOne({
            where: { username: dto.username },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isValid = await bcrypt.compare(dto.password, user.password);
        if (!isValid) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const payload = { userId: user.id, username: user.username };
        const avatar = await this.avatarRepository.findOne({
            where: { id: user.avatarId },
        });
        return { username: user.username, avatar: avatar?.url, token: await this.jwtService.signAsync(payload) };
    }

    async register(dto: RegisterDto, avatar: Express.Multer.File) {
        const avatarUrl = `/static/${avatar.filename}`;
        const avatarEntity = this.avatarRepository.create({
            url: avatarUrl,
        });
        const avatarRes = await this.avatarRepository.save(avatarEntity);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(dto.password, salt);

        const userEntity = this.userRepository.create({
            username: dto.username,
            password: hashedPassword,
            avatarId: avatarRes.id,
        });
        await this.userRepository.save(userEntity);
        return { username: dto.username, password: dto.password };
    }

    async signout(token: string) {
        await this.jwtService.verifyAsync(token);
        return { message: 'Sign out successfully' };
    }
}