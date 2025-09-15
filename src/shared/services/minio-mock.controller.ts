import type { Response } from 'express';

import { createReadStream } from 'node:fs';
import { join } from 'node:path';

import { Controller, Get, Param, Res } from '@nestjs/common';

@Controller('s3-mock')
export class MinioMockController {
  private readonly localDir = join(__dirname, 'minio-mock-storage');

  @Get(':bucketName/:objectName')
  getFile(
    @Res() res: Response,
    @Param('bucketName') bucketName: string,
    @Param('objectName') objectName: string,
  ) {
    const objectFileAbsPath = join(this.localDir, bucketName, objectName);
    const stream = createReadStream(objectFileAbsPath);
    return stream.pipe(res);
  }
}
