import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { JwtModule } from '@nestjs/jwt';
import { Avatar } from './avatar.entity';
import { Conversation } from '../conversation/conversation.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Avatar, Conversation]),
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: Number(process.env.JWT_EXPIRES_IN) || 3600 },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService],
    exports: [AuthService],
})
export class AuthModule { }