import { Test, TestingModule } from '@nestjs/testing';

import { HdWalletService } from './hdwallet.service';
import { WalletController } from './wallet.controller';

describe('WalletModule', () => {
  let service: HdWalletService;
  let controller: WalletController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [HdWalletService],
    }).compile();

    service = module.get<HdWalletService>(HdWalletService);
    controller = module.get<WalletController>(WalletController);
  });

  describe('HdWalletService', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should validate mnemonic correctly', () => {
      const validMnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const invalidMnemonic = 'invalid mnemonic phrase';

      expect(service.validateMnemonic(validMnemonic)).toBe(true);
      expect(service.validateMnemonic(invalidMnemonic)).toBe(false);
    });

    it('should generate addresses from secure entropy', () => {
      const mnemonic = service.generateAddressFromSecure(256);
      expect(mnemonic).toBeDefined();
      expect(typeof mnemonic).toBe('string');
      expect(service.validateMnemonic(mnemonic)).toBe(true);
    });

    it('should validate private keys for different blockchains', () => {
      // Bitcoin WIF private key (testnet)
      const btcPrivateKey = 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA';

      // Ethereum hex private key (64 chars)
      const ethPrivateKey = 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

      // Solana private key (64 bytes hex)
      const solanaPrivateKey = 'a'.repeat(128); // 64 bytes in hex

      expect(service.validatePrivateKey(btcPrivateKey, 'btc')).toBe(true);
      expect(service.validatePrivateKey(ethPrivateKey, 'eth')).toBe(true);
      expect(service.validatePrivateKey(solanaPrivateKey, 'solana')).toBe(true);

      expect(service.validatePrivateKey('invalid', 'btc')).toBe(false);
      expect(service.validatePrivateKey('invalid', 'eth')).toBe(false);
      expect(service.validatePrivateKey('invalid', 'solana')).toBe(false);
    });
  });

  describe('WalletController', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should return health status', () => {
      const health = controller.getHealth();
      expect(health).toBeDefined();
      expect(health.status).toBe('ok');
      expect(health.message).toBe('Wallet service is healthy');
      expect(health.timestamp).toBeDefined();
    });
  });
});
