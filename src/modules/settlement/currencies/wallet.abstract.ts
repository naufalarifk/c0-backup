/*

move implementation to wallet service
*/
export abstract class HotWalletAbstract {
  abstract getBalance(): Promise<string>;
  abstract transfer(toAddress: string, amount: string, options?: any): Promise<string>;
}
