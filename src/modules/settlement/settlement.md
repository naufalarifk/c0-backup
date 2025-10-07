crosschain balance
user deposits from usdt@ethereum to usdt@platfom_ethereum
platform transfer usdt@platform_ethereum -> usdt@platform_crosschain
user withdraws from usdt@platform_crosschain to usdt@ethereum or usdt@solana
user deposits to usdt@solana
platform record balance to usdt@solana (INVOICE WALLET usdt@solana) -> (HOT WALLET usdt@solana) -> (SATTLEMENT usdt@binance)
platform transfer usdt@solana -> usdt@platform_crosschain
user has usdt@crosschain
user can withdraw usdt on any blockchains (SOL, BSC)

on platform usdt@solana + usdt@ethereum + usdt@binance = usdt@accounting

user transfer deposits of usdt@ethereum:mainnet
platform record balance on usdt@ethereum:database
platform transfer balance from usdt@ethereum:database to usdt@crosschain:database
user request withdraw from usdt@crosschain:database to usdt@solana:mainnet

each 24 hours, platform make sure that:

(usdt@ethereum@mainnet + usdt@solana:mainnet) / usdt@binance = configured balance ratio
usdt@ethereum@mainnet + usdt@solana:mainnet + usdt@binance = usdt@ethereum:database + usdt@solana:database + usdt@crosschain:database