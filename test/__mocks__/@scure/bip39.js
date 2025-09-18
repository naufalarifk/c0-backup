module.exports = {
  generateMnemonic: (wordlist) => 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
  mnemonicToSeed: (mnemonic) => Promise.resolve(Buffer.from('mock-seed-64-bytes-long'.repeat(3), 'utf8').slice(0, 64)),
  validateMnemonic: (mnemonic) => true,
};