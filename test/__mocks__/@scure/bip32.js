module.exports = {
  HDKey: class MockHDKey {
    constructor() {
      this.privateKey = Buffer.from('mock-private-key-32-bytes-long-test', 'utf8').slice(0, 32);
      this.publicKey = Buffer.from('mock-public-key-33-bytes-long-test', 'utf8').slice(0, 33);
    }
    
    static fromMasterSeed(seed) {
      return new MockHDKey();
    }
    
    derive(path) {
      return new MockHDKey();
    }
  },
};