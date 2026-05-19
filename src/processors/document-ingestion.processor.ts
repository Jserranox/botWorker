import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { DocumentChunk, DocumentStatus } from '@libs/database';
import { QueueName, JobName, IngestDocumentJob, IngestUrlJob } from '@aero-agent/queue';
import { DocumentsService } from '@botBackEnd/modules/knowledge/services/documents.service';
import { ExtractionService } from '@botBackEnd/modules/knowledge/services/extraction.service';
import { StorageService } from '@botBackEnd/modules/knowledge/services/storage.service';
import { ChunkingService } from '@botBackEnd/modules/rag/services/chunking.service';
import { EmbeddingService } from '@botBackEnd/modules/rag/services/embedding.service';

@Processor(QueueName.INGESTION)
export class DocumentIngestionProcessor extends WorkerHost {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly extractionService: ExtractionService,
    private readonly storageService: StorageService,
    private readonly chunkingService: ChunkingService,
    private readonly embeddingService: EmbeddingService,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
  ) {
    super();
  }

  async process(job: Job<IngestDocumentJob | IngestUrlJob>): Promise<void> {
    switch (job.name) {
      case JobName.INGEST_DOCUMENT:
        return this.handleDocument(job as Job<IngestDocumentJob>);
      case JobName.INGEST_URL:
        return this.handleUrl(job as Job<IngestUrlJob>);
    }
  }

  private async handleDocument(job: Job<IngestDocumentJob>): Promise<void> {
    const { documentId, botId } = job.data;
    await this.documentsService.updateStatus(documentId, DocumentStatus.PROCESSING);

    try {
      const doc = await this.documentsService.findOneRaw(documentId);
      const buffer = await this.storageService.download(doc.storageKey);
      const text = await this.extractionService.extractText(buffer, doc.fileType);

      await this.chunkRepo.delete({ documentId });

      const rawChunks = this.chunkingService.chunkDocument(text);
      const embeddings = await this.embeddingService.embedBatch(
        rawChunks.map((c) => c.content),
      );

      for (let i = 0; i < rawChunks.length; i += 50) {
        const batch = rawChunks.slice(i, i + 50).map((c, idx) =>
          this.chunkRepo.create({
            documentId,
            botId,
            content: c.content,
            chunkIndex: c.chunkIndex,
            embedding: embeddings[i + idx],
          }),
        );
        await this.chunkRepo.save(batch);
      }

      await this.documentsService.update(documentId, { chunkCount: rawChunks.length });
      await this.documentsService.updateStatus(documentId, DocumentStatus.READY);
    } catch (err) {
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.ERROR,
        (err as Error).message,
      );
      throw err;
    }
  }

  private async handleUrl(job: Job<IngestUrlJob>): Promise<void> {
    const { documentId, botId, url } = job.data;
    await this.documentsService.updateStatus(documentId, DocumentStatus.PROCESSING);

    try {
      const text = await this.extractionService.extractFromUrl(url);

      await this.chunkRepo.delete({ documentId });

      const rawChunks = this.chunkingService.chunkDocument(text);
      const embeddings = await this.embeddingService.embedBatch(
        rawChunks.map((c) => c.content),
      );

      for (let i = 0; i < rawChunks.length; i += 50) {
        const batch = rawChunks.slice(i, i + 50).map((c, idx) =>
          this.chunkRepo.create({
            documentId,
            botId,
            content: c.content,
            chunkIndex: c.chunkIndex,
            embedding: embeddings[i + idx],
          }),
        );
        await this.chunkRepo.save(batch);
      }

      await this.documentsService.update(documentId, { chunkCount: rawChunks.length });
      await this.documentsService.updateStatus(documentId, DocumentStatus.READY);
    } catch (err) {
      await this.documentsService.updateStatus(
        documentId,
        DocumentStatus.ERROR,
        (err as Error).message,
      );
      throw err;
    }
  }
}
