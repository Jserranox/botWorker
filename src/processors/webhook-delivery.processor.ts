import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueName, JobName } from '@aero-agent/queue';
import { WebhookDispatcherService } from '@botBackEnd/modules/webhooks/services/webhook-dispatcher.service';

@Processor(QueueName.WEBHOOKS)
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(private readonly webhookDispatcher: WebhookDispatcherService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JobName.WEBHOOK_DISPATCH) {
      await this.webhookDispatcher.processDelivery(job);
    }
  }
}
