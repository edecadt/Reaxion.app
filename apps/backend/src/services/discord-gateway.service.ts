import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  GuildMember,
  PartialGuildMember,
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
} from 'discord.js';
import { WebhookEventsService } from './webhook-events.service';
import { WorkflowRepository } from '../workflow/repositories/workflow.repository';

@Injectable()
export class DiscordGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiscordGatewayService.name);
  private client: Client | null = null;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookEvents: WebhookEventsService,
    @Inject(forwardRef(() => WorkflowRepository))
    private readonly workflowRepository: WorkflowRepository,
  ) {}

  async onModuleInit() {
    const botToken = this.configService.get<string>('DISCORD_BOT_TOKEN');

    if (!botToken) {
      this.logger.warn(
        'DISCORD_BOT_TOKEN not configured. Discord Gateway will not start. Users will need to provide their own bot tokens.',
      );
      return;
    }

    this.logger.log('Starting Discord Gateway connection...');

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    this.setupEventListeners();

    try {
      await this.client.login(botToken);
      this.isConnected = true;
      this.logger.log('Discord Gateway connected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Discord Gateway: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.logger.log('Disconnecting from Discord Gateway...');
      await this.client.destroy();
      this.isConnected = false;
      this.logger.log('Discord Gateway disconnected');
    }
  }

  private setupEventListeners() {
    if (!this.client) return;

    this.client.on(Events.ClientReady, (client) => {
      this.logger.log(`Discord bot logged in as ${client.user.tag}`);
      this.logger.log(`Bot is in ${client.guilds.cache.size} servers`);
    });

    this.client.on(Events.MessageCreate, (message: Message) => {
      this.handleMessageCreate(message);
    });

    this.client.on(Events.GuildMemberAdd, (member: GuildMember) => {
      this.handleMemberJoin(member);
    });

    this.client.on(
      Events.GuildMemberRemove,
      (member: GuildMember | PartialGuildMember) => {
        this.handleMemberLeave(member);
      },
    );

    this.client.on(
      Events.MessageReactionAdd,
      (
        reaction: MessageReaction | PartialMessageReaction,
        user: User | PartialUser,
      ) => {
        this.handleReactionAdd(reaction, user);
      },
    );

    this.client.on(Events.Error, (error) => {
      this.logger.error(`Discord Gateway error: ${error.message}`);
    });

    this.client.on(Events.Warn, (info) => {
      this.logger.warn(`Discord Gateway warning: ${info}`);
    });
  }

  private broadcastToActiveWorkflows(
    serviceId: string,
    actionId: string,
    payload: Record<string, unknown>,
  ) {
    const activeWorkflows = this.workflowRepository.getActiveWorkflows();

    this.logger.debug(
      `Broadcasting ${serviceId}:${actionId} to ${activeWorkflows.length} active workflows`,
    );

    let storedCount = 0;

    for (const workflow of activeWorkflows) {
      // Support both actionId (correct) and action name (legacy bug)
      const hasDiscordAction = workflow.nodes.some((node) => {
        if (node.serviceId !== serviceId) return false;
        // Check if actionId matches (correct) OR if it matches the action name (bug workaround)
        if (node.actionId === actionId) return true;
        // Workaround: check if actionId is the name instead of ID
        const actionNameMap: Record<string, string> = {
          'message-received': 'Message Received',
          'member-join': 'Member Joined',
          'member-leave': 'Member Left',
          'reaction-added': 'Reaction Added',
        };
        return node.actionId === actionNameMap[actionId];
      });

      this.logger.debug(
        `Workflow ${workflow.id}: hasDiscordAction=${hasDiscordAction}, webhookToken=${!!workflow.webhookToken}, userId=${workflow.userId}, nodes=${JSON.stringify(workflow.nodes.map((n) => ({ serviceId: n.serviceId, actionId: n.actionId })))}`,
      );

      if (hasDiscordAction && workflow.webhookToken) {
        this.webhookEvents.storeEvent(
          serviceId,
          actionId,
          payload,
          workflow.userId?.toString(),
          workflow.webhookToken,
        );
        storedCount++;
        this.logger.debug(
          `Stored event for workflow ${workflow.id} (userId=${workflow.userId}, token=${workflow.webhookToken})`,
        );
      }
    }

    this.logger.debug(
      `Stored ${storedCount} events for ${serviceId}:${actionId}`,
    );
  }

  private handleMessageCreate(message: Message) {
    // Don't process messages from the bot itself to avoid loops
    if (message.author.id === this.client?.user?.id) return;

    const payload = {
      messageId: message.id,
      channelId: message.channelId,
      guildId: message.guildId || '',
      authorId: message.author.id,
      authorUsername: message.author.username,
      authorDisplayName: message.author.displayName || message.author.username,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      messageUrl: message.url,
      isBot: message.author.bot,
      isWebhook: message.webhookId !== null && message.webhookId !== undefined,
      roles: message.member?.roles?.cache.map((r) => r.id) || [],
      attachments: message.attachments.map((att) => ({
        id: att.id,
        url: att.url,
        filename: att.name,
        contentType: att.contentType,
      })),
      mentions: message.mentions.users.map((u) => u.id),
      mentionRoles: message.mentions.roles.map((r) => r.id),
      rawMessage: {
        id: message.id,
        type: message.type,
        flags: message.flags.bitfield,
      },
    };

    this.logger.debug(
      `Message received: ${message.id} in guild ${message.guildId}, channel ${message.channelId}`,
    );

    this.broadcastToActiveWorkflows('discord', 'message-received', payload);
  }

  private handleMemberJoin(member: GuildMember) {
    const payload = {
      userId: member.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      displayName: member.displayName || member.user.username,
      joinedAt: member.joinedAt?.toISOString() || new Date().toISOString(),
      isBot: member.user.bot,
      guildId: member.guild.id,
      guildName: member.guild.name,
      memberCount: member.guild.memberCount,
      roles: member.roles.cache.map((r) => r.id),
      avatar: member.user.displayAvatarURL(),
    };

    this.logger.debug(
      `Member joined: ${member.user.username} (${member.id}) in guild ${member.guild.id}`,
    );

    this.broadcastToActiveWorkflows('discord', 'member-join', payload);
  }

  private handleMemberLeave(member: GuildMember | PartialGuildMember) {
    const payload = {
      userId: member.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      displayName: member.displayName || member.user.username,
      leftAt: new Date().toISOString(),
      guildId: member.guild.id,
      guildName: member.guild.name,
      memberCount: member.guild.memberCount,
      roles: member.roles?.cache.map((r) => r.id) || [],
    };

    this.logger.debug(
      `Member left: ${member.user.username} (${member.id}) from guild ${member.guild.id}`,
    );

    this.broadcastToActiveWorkflows('discord', 'member-leave', payload);
  }

  private async handleReactionAdd(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        this.logger.error('Failed to fetch reaction:', error);
        return;
      }
    }

    if (user.partial) {
      try {
        await user.fetch();
      } catch (error) {
        this.logger.error('Failed to fetch user:', error);
        return;
      }
    }

    if (user.bot) return;

    const payload = {
      messageId: reaction.message.id,
      channelId: reaction.message.channelId,
      guildId: reaction.message.guildId || '',
      emoji: reaction.emoji.name || '',
      emojiId: reaction.emoji.id || '',
      emojiAnimated: reaction.emoji.animated || false,
      isCustomEmoji: !!reaction.emoji.id,
      reactionCount: reaction.count,
      userId: user.id,
      username: user.username,
      messageContent: reaction.message.content || '',
      messageAuthorId: reaction.message.author?.id || '',
    };

    this.logger.debug(
      `Reaction added: ${reaction.emoji.name} on message ${reaction.message.id} in guild ${reaction.message.guildId}`,
    );

    this.broadcastToActiveWorkflows('discord', 'reaction-added', payload);
  }

  getStatus(): { connected: boolean; guilds: number } {
    return {
      connected: this.isConnected,
      guilds: this.client?.guilds.cache.size || 0,
    };
  }
}
