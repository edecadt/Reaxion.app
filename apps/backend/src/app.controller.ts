import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Core')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health endpoint returning a welcome message' })
  @ApiOkResponse({
    description: 'Returns a static greeting string',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('about.json')
  @ApiOperation({
    summary: 'Service manifest describing available automation services',
  })
  @ApiOkResponse({
    description: 'Detailed information about available services and actions',
    schema: {
      type: 'object',
      properties: {
        client: {
          type: 'object',
          properties: {
            host: { type: 'string', example: '127.0.0.1' },
          },
        },
        server: {
          type: 'object',
          properties: {
            current_time: {
              type: 'integer',
              example: 1696000000,
            },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'timer' },
                  name: { type: 'string', example: 'timer' },
                  actions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'cron' },
                        name: { type: 'string', example: 'Cron Trigger' },
                        description: {
                          type: 'string',
                          example: 'Triggers on a cron schedule',
                        },
                        input: { type: 'object' },
                      },
                    },
                  },
                  reactions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'log' },
                        name: { type: 'string', example: 'Log Message' },
                        description: {
                          type: 'string',
                          example: 'Writes a log entry',
                        },
                        input: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  getAbout(@Req() req: Request) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientHost = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim()
        : req.ip || req.socket.remoteAddress || undefined;

    return this.appService.buildAboutPayload(clientHost);
  }
}
