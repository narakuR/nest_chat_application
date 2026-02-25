import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Req,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { Conversation } from './conversation.entity';
import { CreateConversationDto } from './dto/conversation.create.dto';
import { UpdateConversationDto } from './dto/conversation.update.dto';

@Controller('conversation')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) { }

  @Post()
  createConversation(
    @Body() conversation: CreateConversationDto,
    @Req() request: Request,
  ): Promise<Conversation> {
    return this.conversationService.createConversation(conversation, request['user'].userId);
  }

  @Get()
  getConversations(@Req() request: Request): Promise<Conversation[]> {
    return this.conversationService.getConversations(request['user'].userId);
  }

  @Get(':id')
  getConversationById(@Param('id') id: number): Promise<Conversation> {
    return this.conversationService.getConversationById(Number(id));
  }

  @Delete(':id')
  deleteConversation(@Param('id') id: number): Promise<void> {
    return this.conversationService.deleteConversation(Number(id));
  }

  @Put(':id')
  updateConversation(
    @Param('id') id: number,
    @Body() conversation: UpdateConversationDto,
  ): Promise<Conversation> {
    return this.conversationService.updateConversation(
      Number(id),
      conversation,
    );
  }
}
