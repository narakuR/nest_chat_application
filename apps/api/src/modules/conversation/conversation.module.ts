import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../auth/user.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Conversation, User])],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule { }
