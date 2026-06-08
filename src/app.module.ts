import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import {
  Organization,
  User,
  ApiKey,
  Bot,
  Session,
  Message,
  KnowledgeDocument,
  DocumentChunk,
  AnalyticsEvent,
  Webhook,
} from '@libs/database';
import { QueueModule, QueueName } from '@aero-agent/queue';
import { KnowledgeModule } from '@botBackEnd/modules/knowledge/knowledge.module';
import { RagModule } from '@botBackEnd/modules/rag/rag.module';
import { WebhooksModule } from '@botBackEnd/modules/webhooks/webhooks.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentIngestionProcessor } from './processors/document-ingestion.processor';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          Organization,
          User,
          ApiKey,
          Bot,
          Session,
          Message,
          KnowledgeDocument,
          DocumentChunk,
          AnalyticsEvent,
          Webhook,
        ],
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([KnowledgeDocument, DocumentChunk]),
    QueueModule.forRoot(),
    BullModule.registerQueue(
      { name: QueueName.INGESTION },
      { name: QueueName.WEBHOOKS },
    ),
    KnowledgeModule,
    RagModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService, DocumentIngestionProcessor, WebhookDeliveryProcessor],
})
export class AppModule {}
