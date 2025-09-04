import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { CreateKycDto } from './dto/create-kyc.dto';
import { KycService } from './kyc.service';

describe('KycService', () => {
  let service: KycService;
  let _repository: jest.Mocked<CryptogadaiRepository>;

  const mockRepository = {
    userSubmitsKyc: jest.fn(),
  };

  // Helper function for creating valid KYC data
  const createValidKycDto = (overrides: Partial<CreateKycDto> = {}): CreateKycDto => ({
    idCardPhoto: 'data:image/jpeg;base64,validbase64data',
    selfiePhoto: 'data:image/jpeg;base64,validbase64data',
    selfieWithIdCardPhoto: 'data:image/jpeg;base64,validbase64data',
    nik: '1234567890123456',
    fullName: 'John Doe',
    birthCity: 'Jakarta',
    birthDate: new Date('1990-01-01'),
    province: 'DKI Jakarta',
    city: 'Jakarta',
    district: 'Central Jakarta',
    subdistrict: 'Menteng',
    address: 'Jl. Test No. 123',
    postalCode: '12345',
    phoneNumber: '081234567890',
    submissionDate: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: CryptogadaiRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    _repository = module.get(CryptogadaiRepository);
  });

  describe('Input Validation', () => {
    it('should reject invalid NIK format', async () => {
      const invalidKycDto = createValidKycDto({
        nik: '123456789', // Invalid: not 16 digits
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid phone number format', async () => {
      const invalidKycDto = createValidKycDto({
        phoneNumber: '123456789', // Invalid: wrong format
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject future birth date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const invalidKycDto = createValidKycDto({
        birthDate: futureDate, // Invalid: future date
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid postal code', async () => {
      const invalidKycDto = createValidKycDto({
        postalCode: '1234', // Invalid: not 5 digits
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject invalid name format', async () => {
      const invalidKycDto = createValidKycDto({
        fullName: 'John@Doe123', // Invalid: contains special characters and numbers
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Security Controls', () => {
    it('should reject empty or invalid user ID', async () => {
      const validKycDto = createValidKycDto();

      await expect(service.createKyc('', validKycDto)).rejects.toThrow(BadRequestException);

      // biome-ignore lint/suspicious/noExplicitAny: <needed for test>
      await expect(service.createKyc(null as any, validKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject oversized base64 images', async () => {
      // Create a large base64 string (> 10MB)
      const largeBase64 = 'data:image/jpeg;base64,' + 'a'.repeat(15 * 1024 * 1024);

      const invalidKycDto = createValidKycDto({
        idCardPhoto: largeBase64, // Invalid: too large
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject unsupported image formats', async () => {
      const invalidKycDto = createValidKycDto({
        idCardPhoto: 'data:image/gif;base64,validbase64data', // Invalid: not JPEG/PNG
      });

      await expect(service.createKyc('user123', invalidKycDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
