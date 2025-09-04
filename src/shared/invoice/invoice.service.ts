import { HDKey } from '@scure/bip32';
import { generateMnemonic as _generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { WalletService } from 'src/shared/wallets/wallet.service';
import { WalletInstanceService } from 'src/shared/wallets/wallet-instance.service';

import {
  IInvoiceService,
  PlatformCreateLoanOfferPrincipalInvoiceParams,
  PlatformCreateLoanOfferPrincipalInvoiceResult,
} from './invoice.types';

type AllowedKeyEntropyBits = 128 | 256;

export class InvoiceService implements IInvoiceService {
  private readonly walletService: WalletService;
  async platformCreateLoanOfferPrincipalInvoice(
    params: PlatformCreateLoanOfferPrincipalInvoiceParams,
  ): Promise<PlatformCreateLoanOfferPrincipalInvoiceResult> {
    const { principalAmount, principalBlockchainKey } = params;

    function generateAddressFromSecure(entropy: AllowedKeyEntropyBits = 256): string {
      if (entropy !== 128 && entropy !== 256) {
        throw new Error(
          `Invalid entropy. Allowed values are 128 or 256 bits. got: ${String(entropy)}`,
        );
      }

      return _generateMnemonic(wordlist, entropy);
    }

    const mnemonic = generateAddressFromSecure();
    const seed = await mnemonicToSeed(mnemonic);
    const masterKey = HDKey.fromMasterSeed(seed);

    const walletService = WalletInstanceService.prototype;
    const generateWallet = walletService
      .getProvider(principalBlockchainKey)
      .generateWallet(masterKey, 0, 0);
    console.log('generateWallet', generateWallet);
    return {
      //asked to change to object below
      principalBlockchainKey: principalBlockchainKey.key,
      principalAmount,
    };
  }
}
