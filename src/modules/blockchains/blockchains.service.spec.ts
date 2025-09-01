import { Test, TestingModule } from '@nestjs/testing';

import { BlockchainsService } from './blockchains.service';
import { CreateBlockchainDto } from './dto/create-blockchain.dto';
import { UpdateBlockchainDto } from './dto/update-blockchain.dto';

describe('BlockchainsService', () => {
  let service: BlockchainsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlockchainsService],
    }).compile();

    service = module.get<BlockchainsService>(BlockchainsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should return creation message', () => {
      const createDto: CreateBlockchainDto = { name: 'Ethereum' };
      const result = service.create(createDto);
      expect(result).toBe('This action adds a new blockchain');
    });
  });

  describe('findAll', () => {
    it('should return all blockchains message', () => {
      const result = service.findAll();
      expect(result).toBe('This action returns all blockchains');
    });
  });

  describe('findOne', () => {
    it('should return specific blockchain message', () => {
      const result = service.findOne(1);
      expect(result).toBe('This action returns a #1 blockchain');
    });

    it('should handle different IDs', () => {
      expect(service.findOne(42)).toBe('This action returns a #42 blockchain');
      expect(service.findOne(0)).toBe('This action returns a #0 blockchain');
    });
  });

  describe('update', () => {
    it('should return update message', () => {
      const updateDto: UpdateBlockchainDto = { name: 'Updated Ethereum' };
      const result = service.update(1, updateDto);
      expect(result).toBe('This action updates a #1 blockchain');
    });

    it('should handle different IDs', () => {
      const updateDto: UpdateBlockchainDto = {};
      expect(service.update(99, updateDto)).toBe('This action updates a #99 blockchain');
    });
  });

  describe('remove', () => {
    it('should return remove message', () => {
      const result = service.remove(1);
      expect(result).toBe('This action removes a #1 blockchain');
    });

    it('should handle different IDs', () => {
      expect(service.remove(123)).toBe('This action removes a #123 blockchain');
    });
  });
});
