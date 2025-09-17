import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('about.json')
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
