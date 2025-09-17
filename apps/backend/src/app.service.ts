import { Injectable } from '@nestjs/common';

type SupportedService = {
  name: string;
  actions: Array<{ name: string; description: string }>;
  reactions: Array<{ name: string; description: string }>;
};

@Injectable()
export class AppService {
  private readonly services: SupportedService[] = [
    {
      name: 'facebook',
      actions: [
        {
          name: 'new_post',
          description: 'Triggered when a user publishes a new post.',
        },
        {
          name: 'new_comment',
          description: 'Triggered when a comment is added to a post.',
        },
      ],
      reactions: [
        {
          name: 'send_email',
          description: 'Send an email notification to subscribed users.',
        },
        {
          name: 'save_to_archive',
          description: 'Archive the event inside the dashboard.',
        },
      ],
    },
  ];

  getHello(): string {
    return 'Hello World!';
  }

  buildAboutPayload(clientHost: string | undefined) {
    return {
      client: {
        host: clientHost ?? '',
      },
      server: {
        current_time: Math.floor(Date.now() / 1000),
        services: this.services,
      },
    };
  }
}
