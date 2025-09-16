import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { AddressValidator } from '../../../../shared/utils/address-validator';

interface BlockchainAddressDto {
  blockchainKey: string;
  address: string;
}

@ValidatorConstraint({ name: 'isValidBlockchainAddress', async: false })
export class IsValidBlockchainAddressConstraint implements ValidatorConstraintInterface {
  validate(address: string, args: ValidationArguments): boolean {
    const dto = args.object as BlockchainAddressDto;
    const blockchainKey = dto.blockchainKey;

    if (!blockchainKey || !address) {
      return false;
    }

    return AddressValidator.validateAddress(blockchainKey, address);
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as BlockchainAddressDto;
    const blockchainKey = dto.blockchainKey;
    const blockchainType = blockchainKey
      ? AddressValidator.getBlockchainType(blockchainKey)
      : 'Unknown';

    return `Address must be a valid ${blockchainType} address`;
  }
}

export function IsValidBlockchainAddress(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidBlockchainAddressConstraint,
    });
  };
}
