import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { CreateConversationDto } from './dto/conversation.create.dto';
import { UpdateConversationDto } from './dto/conversation.update.dto';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
  ) { }

  async createConversation(dto: CreateConversationDto, userId: number): Promise<Conversation> {
    const conversation = this.conversationRepository.create({
      ...dto,
      user: {
        id: userId,
      },
    });
    return this.conversationRepository.save(conversation);
  }

  async getConversations(userId: number): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: {
        isDeleted: false,
        user: {
          id: userId,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getConversationById(id: number): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: {
        id,
        isDeleted: false,
      },
      relations: ['messages'],
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  async deleteConversation(id: number): Promise<void> {
    await this.conversationRepository.update(id, { isDeleted: true });
  }

  async updateConversation(
    id: number,
    dto: UpdateConversationDto,
  ): Promise<Conversation> {
    await this.conversationRepository.update(id, dto);
    return this.getConversationById(id);
  }
}
