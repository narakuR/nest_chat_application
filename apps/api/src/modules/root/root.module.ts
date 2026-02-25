import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RootController } from './root.controller';
// import { ChatModule } from '../chat/chat.module';
import { ConversationModule } from '../conversation/conversation.module';
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter';
import { AuthGuard } from '../../guards/auth.guard';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { TransformInterceptor } from '../../interceptors/transform.interceptor';
import { typeOrmConfig } from '../../lib/typeorm';
import { logger } from '../../middlewares/logger.middleware';
import cors from 'cors';
import { MessagesModule } from '../messages/messages.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot(), typeOrmConfig, ConversationModule, MessagesModule, AuthModule],
  controllers: [RootController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class RootModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(cors(), logger)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
