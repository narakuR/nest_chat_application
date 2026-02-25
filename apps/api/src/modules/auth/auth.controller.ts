import { Controller, Post, Body, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../decorators/public-api';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';


@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('signin')
    signin(@Body() body: LoginDto) {
        return this.authService.signin(body);
    }

    @Post('signout')
    signout(@Req() request: Request) {
        const token = request.headers['authorization']?.split(' ')[1];
        
        return this.authService.signout(token);
    }
    @Public()
    @Post('register')
    @UseInterceptors(FileInterceptor('avatar', {
        storage: diskStorage({
            destination: 'static', // 物理存储目录（相对项目根）
            filename: (req, file, cb) => {
                const ext = extname(file.originalname); // .png / .jpg
                const filename = `${Date.now()}-${randomUUID()}${ext}`;
                cb(null, filename);
            },
        }),
    }))
    register(@Body() body: RegisterDto, @UploadedFile() avatar: Express.Multer.File) {
        return this.authService.register(body, avatar);
    }
}