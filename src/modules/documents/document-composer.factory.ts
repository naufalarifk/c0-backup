import type { DocumentType } from './document.types';

import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { DocumentComposer, DocumentComposerAbstract } from './document-composer.abstract';

@Injectable()
export class DocumentComposerFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  getComposer(type: DocumentType): DocumentComposerAbstract | undefined {
    const providers = this.discoveryService.getProviders();
    const composer = providers.find(provider => {
      return this.discoveryService.getMetadataByDecorator(DocumentComposer, provider) === type;
    })?.instance;
    return composer instanceof DocumentComposerAbstract ? composer : undefined;
  }
}
