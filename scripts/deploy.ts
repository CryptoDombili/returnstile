import { ethers } from 'hardhat';

const DOJANG_SCROLL = '0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9';
const UPBIT_KOREA_ATTESTER_ID = '0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034';

async function main() {
  const factory = await ethers.getContractFactory('Returnstile');
  const contract = await factory.deploy(DOJANG_SCROLL, UPBIT_KOREA_ATTESTER_ID);
  await contract.waitForDeployment();

  console.log('Returnstile deployed to:', await contract.getAddress());
  console.log('GIWA Explorer:', `https://sepolia-explorer.giwa.io/address/${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
