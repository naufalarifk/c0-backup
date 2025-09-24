const { generatePrivateKey, privateKeyToAccount, privateKeyToAddress, generateMnemonic, english } = require('viem/accounts')

function main() {
  const privateKey = generatePrivateKey()
  console.log('Generated Private Key:', privateKey)

  const address = privateKeyToAddress(privateKey)
  console.log('Derived Address:', address)

  const account = privateKeyToAccount(privateKey)
  console.log('Derived Account:', account)

  const mnemonic = generateMnemonic(english)
  console.log('Generated Mnemonic:', mnemonic)
}

main();
