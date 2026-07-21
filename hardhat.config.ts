import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    giwaSepolia: {
      url: process.env.GIWA_RPC_URL ?? "http://127.0.0.1:8545",
      chainId: 91342,
      accounts: privateKey ? [privateKey] : []
    }
  }
};

export default config;
