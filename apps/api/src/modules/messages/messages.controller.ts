import { Controller, Post, Body, Sse, Param, Res } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/messages.create.dto';
import type { Response } from 'express';
import type { Stream } from 'openai/core/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { Observable } from 'rxjs';
import { Public } from 'src/decorators/public-api';

@Public()
@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    private streamMap = new Map<
        CreateMessageDto['uid'],
        Stream<ChatCompletionChunk>
    >();
    private conversationId: number;

    @Post()
    async createMessage(@Body() message: CreateMessageDto) {
        this.conversationId = message.conversationId;
        const result = await this.messagesService.createMessage(message);
        if (!result) {
            return null;
        }
        const { stream, createdAt } = result;
        if (stream) {
            this.streamMap.set(message.uid, stream);
        }
        return createdAt;
    }


    @Sse("/:uid")
    streamMessage(@Param('uid') uid: string, @Res() res: Response) {
        const stream = this.streamMap.get(uid);
        if (!stream) {
            return new Observable((subscriber) => {
                subscriber.error(new Error('stream not found'));
            });
        }
        return new Observable((subscriber) => {
            res.on('close', () => {
                subscriber.complete();
                this.streamMap.delete(uid);
            });
            this.messagesService
                .streamMessage(stream!, subscriber, this.conversationId)
                .then((createdAt) => {
                    subscriber.next({
                        data: {
                            type: 'done',
                            data: createdAt ?? null,
                        },
                    });
                    subscriber.complete();
                    this.streamMap.delete(uid);
                })
                .catch((error) => {
                    console.error(`Stream ${uid} error:`, error);
                    subscriber.error(error);
                    this.streamMap.delete(uid);
                });
        });
    }
}
