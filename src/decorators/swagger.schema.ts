import type { Type } from '@nestjs/common';
import type {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import type { ApiFile } from '../shared/types';

import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

import _ from 'lodash';

// ========================================
// CONSTANTS
// ========================================

const PARAMTYPES_METADATA = 'design:paramtypes';
const ROUTE_ARGS_METADATA = '__routeArguments__';

// ========================================
// INTERFACES
// ========================================

interface ParameterMetadata {
  index: number;
  data?: string;
}

interface ParameterWithType {
  type: Type<unknown>;
  name?: string;
  required: boolean;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function reverseObjectKeys<T extends Record<string, unknown>>(originalObject: T): T {
  const reversedObject = {} as T;
  const keys = Object.keys(originalObject).reverse();

  for (const key of keys) {
    reversedObject[key as keyof T] = originalObject[key as keyof T];
  }

  return reversedObject;
}

function explore(instance: object, propertyKey: string | symbol): Type<unknown> | null {
  const types: Array<Type<unknown>> = Reflect.getMetadata(
    PARAMTYPES_METADATA,
    instance,
    propertyKey,
  );
  const routeArgsMetadata: Record<string, ParameterMetadata> =
    Reflect.getMetadata(ROUTE_ARGS_METADATA, instance.constructor, propertyKey) || {};

  const parametersWithType: Record<string, ParameterWithType> = _.mapValues(
    reverseObjectKeys(routeArgsMetadata),
    (param: ParameterMetadata) => ({
      type: types[param.index],
      name: param.data,
      required: true,
    }),
  );

  for (const [key, value] of Object.entries(parametersWithType)) {
    const keyPair = key.split(':');

    if (Number(keyPair[0]) === 3) {
      return value.type;
    }
  }

  return null;
}

// ========================================
// INTERNAL DECORATORS
// ========================================

function RegisterModels(): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const body = explore(target, propertyKey);

    return body && ApiExtraModels(body)(target, propertyKey, descriptor);
  };
}

function ApiFileDecorator(
  files: ApiFile[] = [],
  options: Partial<{ isRequired: boolean }> = {},
): MethodDecorator {
  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const { isRequired = false } = options;
    const fileSchema: SchemaObject = {
      type: 'string',
      format: 'binary',
    };
    const properties: Record<string, SchemaObject | ReferenceObject> = {};

    for (const file of files) {
      const formattedName = file.name
        .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();

      properties[file.name] = file.isArray
        ? {
            type: 'array',
            items: fileSchema,
            description: `Upload ${formattedName} file(s)`,
          }
        : {
            ...fileSchema,
            description: `Upload ${formattedName} file`,
          };
    }

    let schema: SchemaObject = {
      properties,
      type: 'object',
      required: isRequired ? files.map(f => f.name) : undefined,
    };
    const body = explore(target, propertyKey);

    if (body) {
      schema = {
        allOf: [
          {
            $ref: getSchemaPath(body),
          },
          {
            properties,
            type: 'object',
            required: isRequired ? files.map(f => f.name) : undefined,
          },
        ],
      };
    }

    return ApiBody({
      schema,
      required: isRequired,
    })(target, propertyKey, descriptor);
  };
}

// ========================================
// PUBLIC API
// ========================================

export function ApiFile(
  files: _.Many<ApiFile>,
  options: Partial<{ isRequired: boolean }> = {},
): MethodDecorator {
  const filesArray = _.castArray(files);

  // Use FileFieldsInterceptor for multiple files instead of separate FileInterceptors
  const fileFields = filesArray.map(file => ({
    name: file.name,
    maxCount: file.isArray ? 5 : 1, // Stricter limit: array max 5, single max 1
  }));

  const interceptor =
    fileFields.length > 1
      ? UseInterceptors(FileFieldsInterceptor(fileFields))
      : UseInterceptors(
          filesArray[0].isArray
            ? FilesInterceptor(filesArray[0].name)
            : FileInterceptor(filesArray[0].name),
        );

  return applyDecorators(
    RegisterModels(),
    ApiConsumes('multipart/form-data'),
    ApiFileDecorator(filesArray, options),
    interceptor,
  );
}
