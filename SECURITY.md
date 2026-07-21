# Security notes

Returnstile is an early testnet prototype and has not been independently audited.

## Privacy boundary

The application must never request, upload, persist or publish identity documents or raw personally identifying information. Optional Dojang mode reads only an existing onchain verification result.

## Wallet safety

Use a dedicated testnet burner wallet. Never commit private keys, seed phrases or `.env` files.

## Contract design choices

- Wallet-bound records instead of transferable ERC-721 tickets
- Checks-effects-interactions and ReentrancyGuard
- Pull-based refunds
- Fixed face-value claims
- FIFO queue with expiring offers
- Single-use signed check-in
- Organizer withdrawal only after the return deadline

## Before production

- Independent smart contract audit
- Invariant and fuzz testing
- Production-grade RPC
- Monitoring and incident response
- Legal review for ticketing and refunds
- Clear organizer terms and cancellation policy
