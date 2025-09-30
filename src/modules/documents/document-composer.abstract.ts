import type { DocumentData, DocumentType, GeneratedDocument } from './document.types';

import { DiscoveryService } from '@nestjs/core';

export const DocumentComposer = DiscoveryService.createDecorator<DocumentType>();

export abstract class DocumentComposerAbstract<T extends DocumentData = DocumentData> {
  abstract generateDocument(data: T): Promise<GeneratedDocument>;
}
