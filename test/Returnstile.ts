import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Returnstile v0.7 multi-asset escrow', function () {
  async function deployFixture() {
    const [owner, organizer, holder, waiter, outsider] = await ethers.getSigners();
    const dojang = await ethers.deployContract('MockDojangScroll');
    const protocol = await ethers.deployContract('Returnstile', [await dojang.getAddress(), ethers.ZeroHash]);
    const usdc = await ethers.deployContract('MockERC20', ['USD Coin', 'USDC', 6]);
    const usdt = await ethers.deployContract('MockERC20', ['Tether USD', 'USDT', 6]);
    await usdc.mint(holder.address, 1_000_000_000n);
    await usdc.mint(waiter.address, 1_000_000_000n);
    await usdt.mint(holder.address, 1_000_000_000n);
    return { owner, organizer, holder, waiter, outsider, dojang, protocol, usdc, usdt };
  }
  async function createEvent(protocol:any, organizer:any, paymentToken:string, price:bigint, capacity=1, verifiedOnly=false){
    const now=await time.latest();
    await protocol.connect(organizer).createEvent(ethers.keccak256(ethers.toUtf8Bytes('demo')),paymentToken,price,now+7*86400,now+6*86400,capacity,900,verifiedOnly);
    return 1n;
  }
  it('supports native ETH escrow and releases proceeds only after the event starts', async function(){
    const {protocol,organizer,holder}=await deployFixture();
    await createEvent(protocol,organizer,ethers.ZeroAddress,ethers.parseEther('0.01'));
    await protocol.connect(holder).buyTicket(1,{value:ethers.parseEther('0.01')});
    expect(await ethers.provider.getBalance(await protocol.getAddress())).to.equal(ethers.parseEther('0.01'));
    await expect(protocol.connect(organizer).withdrawOrganizerProceeds(1)).to.be.revertedWithCustomError(protocol,'EventAlreadyStarted');
    await time.increase(8*86400);
    await expect(protocol.connect(organizer).withdrawOrganizerProceeds(1)).to.changeEtherBalance(organizer,ethers.parseEther('0.01'));
  });
  it('supports USDC escrow, cancellation credit and token withdrawal', async function(){
    const {protocol,organizer,holder,usdc}=await deployFixture();
    const price=25_000_000n;
    await createEvent(protocol,organizer,await usdc.getAddress(),price,2,false);
    await usdc.connect(holder).approve(await protocol.getAddress(),price);
    await protocol.connect(holder).buyTicket(1);
    expect(await usdc.balanceOf(await protocol.getAddress())).to.equal(price);
    await protocol.connect(organizer).cancelEvent(1);
    await protocol.connect(holder).claimCancellationRefund(1);
    expect(await protocol.refundCredit(await usdc.getAddress(),holder.address)).to.equal(price);
    await expect(protocol.connect(holder).withdrawRefund(await usdc.getAddress())).to.changeTokenBalance(usdc,holder,price);
  });
  it('supports USDT-style ERC20 ticket returns and FIFO reassignment', async function(){
    const {protocol,organizer,holder,waiter,usdt}=await deployFixture();
    const price=10_000_000n;
    await createEvent(protocol,organizer,await usdt.getAddress(),price,1,false);
    await usdt.connect(holder).approve(await protocol.getAddress(),price);
    await protocol.connect(holder).buyTicket(1);
    await protocol.connect(waiter).joinWaitlist(1);
    await protocol.connect(holder).returnTicket(1);
    await usdt.mint(waiter.address, price);
    await usdt.connect(waiter).approve(await protocol.getAddress(),price);
    await expect(protocol.connect(waiter).claimReleasedSeat(1)).to.emit(protocol,'TicketClaimed');
    expect(await protocol.refundCredit(await usdt.getAddress(),holder.address)).to.equal(price);
  });
  it('keeps verified organizer and verified-access rules separate', async function(){
    const {protocol,owner,organizer,holder,dojang}=await deployFixture();
    await createEvent(protocol,organizer,ethers.ZeroAddress,0n,2,true);
    await expect(protocol.connect(holder).buyTicket(1)).to.be.revertedWithCustomError(protocol,'NotVerified');
    await protocol.connect(owner).setOrganizerApproval(organizer.address,true);
    expect(await protocol.isOrganizerVerified(organizer.address)).to.equal(false);
    await dojang.setVerified(organizer.address,true);
    expect(await protocol.isOrganizerVerified(organizer.address)).to.equal(true);
    await dojang.setVerified(holder.address,true);
    await expect(protocol.connect(holder).buyTicket(1)).to.emit(protocol,'TicketClaimed');
  });
});
