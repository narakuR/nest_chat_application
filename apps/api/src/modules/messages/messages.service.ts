import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from './dto/messages.create.dto';
import { Message, MessageRole } from './messages.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../conversation/conversation.entity';

import type { Stream } from 'openai/core/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { Subscriber } from 'rxjs';
import OpenAI from 'openai';

@Injectable()
export class MessagesService {
    constructor(
        @InjectRepository(Message)
        private messageRepository: Repository<Message>,

        @InjectRepository(Conversation)
        private conversationRepository: Repository<Conversation>,
    ) { }

    private readonly openai = new OpenAI({
        baseURL: process.env.DEEPSEEK_BASE_URL,
        apiKey: process.env.DEEPSEEK_API_KEY,
    });

    async getContextHistory(conversationId: number): Promise<Message[]> {
        const conversation = await this.conversationRepository.findOne({
            where: { id: conversationId },
            order: { createdAt: 'ASC' },
            relations: ['messages'],
        });
        return conversation?.messages || [];
    }

    async createMessage(dto: CreateMessageDto): Promise<{
        stream: Stream<ChatCompletionChunk> | null;
        createdAt: string;
    }> {
        try {
            const createdAt = new Date();
            const abortController = new AbortController();
            const contextHistory = await this.getContextHistory(dto.conversationId);
            const historyMessages = contextHistory.map((message) => ({
                role: message.role,
                content: message.content,
            }));
            // @ts-expect-error DeepSeek specific param
            const stream = await this.openai.chat.completions.create(
                {
                    model: 'deepseek-chat',
                    messages: [
                        ...historyMessages,
                        { role: 'user', content: dto.content },
                    ],
                    temperature: 0.5,
                    stream: true,
                    max_tokens: 4096,
                    thinking: {
                        type: dto.deepThink ? 'enabled' : 'disabled',
                    },
                },
                {
                    signal: abortController.signal,
                },
            );
            const newContent = this.messageRepository.create({
                content: dto.content,
                role: MessageRole.USER,
                conversation: { id: dto.conversationId },
            });
            await this.messageRepository.save(newContent);
            return {
                stream,
                createdAt: createdAt.toISOString(),
            };
        } catch (error) {
            throw error;
        }
    }


    async streamMessage(
        stream: Stream<ChatCompletionChunk>,
        subscriber: Subscriber<Partial<MessageEvent>>,
        conversationId: number
    ): Promise<string | null> {
        let finalToken = '';
        let reasoningToken = '';
        try {
            const createdAt = new Date();
            for await (const chunk of stream) {
                if (chunk.choices[0].finish_reason != null) {
                    stream.controller?.abort();
                    break;
                }
                const isReasoning =
                    'reasoning_content' in chunk.choices[0].delta &&
                    chunk.choices[0].delta.reasoning_content != null;
                if (isReasoning) {
                    // @ts-expect-error DeepSeek specific param
                    reasoningToken += chunk.choices[0].delta.reasoning_content;
                } else {
                    finalToken += chunk.choices[0].delta.content;
                }
                subscriber.next({
                    data: {
                        type: isReasoning ? 'reasoning' : 'message',
                        data: isReasoning
                            ? // @ts-expect-error DeepSeek specific param
                            chunk.choices[0].delta.reasoning_content
                            : chunk.choices[0].delta.content,
                    },
                });
            }
            const messageEntity = this.messageRepository.create({
                content: finalToken,
                reasoning: reasoningToken,
                role: MessageRole.ASSISTANT,
                createdAt: createdAt,
                conversation: { id: conversationId },
            });
            await this.messageRepository.save(messageEntity);
            return createdAt.toISOString();
        } catch (error) {
            console.error('streamMessages error', error);
            throw error;
        }
    }
}
