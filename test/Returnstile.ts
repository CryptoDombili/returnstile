import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Returnstile', function () {
  async function deployFixture() {
    const [organizer, holder, waiter, outsider] = await ethers.getSigners();
    const dojang = await ethers.deployContract('MockDojangScroll');
    const protocol = await ethers.deployContract('Returnstile', [await dojang.getAddress(), ethers.ZeroHash]);
    return { organizer, holder, waiter, outsider, dojang, protocol };
  }

  async function createEvent(protocol: any, organizer: any, capacity = 1, verifiedOnly = false) {
    const now = await time.latest();
    await protocol.connect(organizer).createEvent(
      ethers.keccak256(ethers.toUtf8Bytes('ipfs://returnstile-demo')),
      ethers.parseEther('0.01'),
      now + 7 * 24 * 60 * 60,
      now + 6 * 24 * 60 * 60,
      capacity,
      15 * 60,
      verifiedOnly,
    );
    return 1n;
  }

  it('allows open event purchase and prevents duplicate active tickets', async function () {
    const { protocol, organizer, holder } = await deployFixture();
    await createEvent(protocol, organizer, 2, false);
    await protocol.connect(holder).buyTicket(1, { value: ethers.parseEther('0.01') });
    await expect(protocol.connect(holder).buyTicket(1, { value: ethers.parseEther('0.01') }))
      .to.be.revertedWithCustomError(protocol, 'AlreadyHasActiveTicket');
  });

  it('enforces optional Dojang verification', async function () {
    const { protocol, dojang, organizer, holder } = await deployFixture();
    await createEvent(protocol, organizer, 2, true);
    await expect(protocol.connect(holder).buyTicket(1, { value: ethers.parseEther('0.01') }))
      .to.be.revertedWithCustomError(protocol, 'NotVerified');
    await dojang.setVerified(holder.address, true);
    await expect(protocol.connect(holder).buyTicket(1, { value: ethers.parseEther('0.01') }))
      .to.emit(protocol, 'TicketClaimed');
  });

  it('returns a ticket and reassigns it to the FIFO waitlist at face value', async function () {
    const { protocol, organizer, holder, waiter } = await deployFixture();
    await createEvent(protocol, organizer, 1, false);
    await protocol.connect(holder).buyTicket(1, { value: ethers.parseEther('0.01') });
    await protocol.connect(waiter).joinWaitlist(1);
    await protocol.connect(holder).returnTicket(1);
    expect(await protocol.refundCredit(holder.address)).to.equal(ethers.parseEther('0.01'));
    await expect(protocol.connect(waiter).claimReleasedSeat(1, { value: ethers.parseEther('0.01') }))
      .to.emit(protocol, 'TicketClaimed')
      .withArgs(1, 2, waiter.address, true);
  });

  it('blocks check-in replay after a valid holder signature', async function () {
    const { protocol, organizer, holder } = await deployFixture();
    await createEvent(protocol, organizer, 1, false);
    await protocol.connect(holder).buyTicket(1, { value: ethers.parseEther('0.01') });
    const deadline = BigInt((await time.latest()) + 3600);
    const digest = await protocol.getCheckInDigest(1, 0, deadline);
    const signature = await holder.signMessage(ethers.getBytes(digest));
    await expect(protocol.connect(organizer).checkInWithSignature(1, deadline, signature))
      .to.emit(protocol, 'TicketCheckedIn');
    await expect(protocol.connect(organizer).checkInWithSignature(1, deadline, signature))
      .to.be.revertedWithCustomError(protocol, 'InvalidTicketState');
  });
});
