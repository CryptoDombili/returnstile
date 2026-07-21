import { createPublicClient, custom, defineChain, getContract, http, type Address } from 'viem';

export const GIWA_SEPOLIA_CHAIN_ID = 91342;
export const GIWA_SEPOLIA_HEX_CHAIN_ID = `0x${GIWA_SEPOLIA_CHAIN_ID.toString(16)}`;
export const GIWA_RPC_URL = 'https://sepolia-rpc.giwa.io';
export const GIWA_EXPLORER_URL = 'https://sepolia-explorer.giwa.io';
export const DOJANG_SCROLL_ADDRESS = '0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9' as Address;
export const UPBIT_KOREA_ATTESTER_ID =
  '0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034' as const;

export const giwaSepolia = defineChain({
  id: GIWA_SEPOLIA_CHAIN_ID,
  name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [GIWA_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'GIWA Explorer', url: GIWA_EXPLORER_URL },
  },
  testnet: true,
});

const dojangAbi = [
  {
    type: 'function',
    name: 'isVerified',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'attesterId', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const publicClient = createPublicClient({
  chain: giwaSepolia,
  transport: http(GIWA_RPC_URL),
});

export async function checkDojangVerification(address: Address): Promise<boolean | null> {
  try {
    const contract = getContract({
      address: DOJANG_SCROLL_ADDRESS,
      abi: dojangAbi,
      client: publicClient,
    });
    return await contract.read.isVerified([address, UPBIT_KOREA_ATTESTER_ID]);
  } catch {
    return null;
  }
}

export async function ensureGiwaNetwork(): Promise<boolean> {
  const ethereum = window.ethereum;
  if (!ethereum) return false;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: GIWA_SEPOLIA_HEX_CHAIN_ID }],
    });
    return true;
  } catch (error) {
    const switchError = error as { code?: number };
    if (switchError.code !== 4902) return false;

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: GIWA_SEPOLIA_HEX_CHAIN_ID,
          chainName: 'GIWA Sepolia',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: [GIWA_RPC_URL],
          blockExplorerUrls: [GIWA_EXPLORER_URL],
        },
      ],
    });
    return true;
  }
}

export async function connectInjectedWallet(): Promise<Address | null> {
  if (!window.ethereum) return null;
  await ensureGiwaNetwork();
  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  return (accounts[0] as Address | undefined) ?? null;
}

export function getWalletClient() {
  if (!window.ethereum) return null;
  return custom(window.ethereum);
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}
