import type { Observable } from 'rxjs';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { mergeMap } from 'rxjs/operators';

import { deepResolvePromises } from '../utils';

@Injectable()
export class ResolvePromisesInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(mergeMap(data => deepResolvePromises(data)));
  }
}
