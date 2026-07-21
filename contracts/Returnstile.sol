// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IDojangScroll {
    function isVerified(address user, bytes32 attesterId) external view returns (bool);
}

/// @title Returnstile
/// @notice Wallet-bound event passes with fair returns, escrowed ETH/ERC20 payments,
/// verified organizers and cancellation refunds.
contract Returnstile is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using SafeERC20 for IERC20;

    enum TicketStatus { None, Active, Returned, CheckedIn, CancelledRefunded }

    struct EventData {
        address organizer;
        address paymentToken; // address(0) = native ETH
        bytes32 metadataHash;
        uint96 price;
        uint40 startsAt;
        uint40 returnDeadline;
        uint32 capacity;
        uint32 activeTickets;
        uint32 releasedSeats;
        uint32 queueHead;
        uint40 currentOfferStartedAt;
        uint40 claimWindow;
        bool verifiedOnly;
        bool paused;
        bool cancelled;
        uint256 organizerWithdrawn;
    }

    struct TicketData {
        uint256 eventId;
        address holder;
        TicketStatus status;
        uint64 checkInNonce;
    }

    error EventNotFound(); error TicketNotFound(); error NotOrganizer(); error EventPaused();
    error EventCancelled(); error EventNotCancelled(); error EventAlreadyStarted(); error InvalidSchedule();
    error InvalidCapacity(); error InvalidClaimWindow(); error IncorrectPayment(); error EventNotSoldOut();
    error EventSoldOut(); error AlreadyHasActiveTicket(); error NotVerified(); error AlreadyInQueue();
    error NotInQueue(); error NoReleasedSeat(); error NotQueueHead(); error OfferExpired();
    error OfferStillActive(); error ReturnWindowClosed(); error InvalidTicketState(); error NotTicketHolder();
    error SignatureExpired(); error InvalidCheckInSignature(); error NothingToWithdraw(); error TransferFailed();

    event EventCreated(uint256 indexed eventId, address indexed organizer, bytes32 indexed metadataHash, address paymentToken, uint256 price, uint256 capacity, bool verifiedOnly);
    event EventPausedSet(uint256 indexed eventId, bool paused);
    event EventCancelledSet(uint256 indexed eventId, address indexed organizer);
    event OrganizerApprovalSet(address indexed organizer, bool approved);
    event TicketClaimed(uint256 indexed eventId, uint256 indexed ticketId, address indexed holder, bool fromQueue);
    event WaitlistJoined(uint256 indexed eventId, address indexed account, uint256 position);
    event QueueOfferStarted(uint256 indexed eventId, address indexed account, uint256 expiresAt);
    event QueueOfferSkipped(uint256 indexed eventId, address indexed skippedAccount);
    event TicketReturned(uint256 indexed eventId, uint256 indexed ticketId, address indexed holder, address paymentToken, uint256 refundAmount);
    event CancellationRefundClaimed(uint256 indexed eventId, uint256 indexed ticketId, address indexed holder, address paymentToken, uint256 refundAmount);
    event RefundWithdrawn(address indexed account, address indexed paymentToken, uint256 amount);
    event TicketCheckedIn(uint256 indexed eventId, uint256 indexed ticketId, address indexed holder);
    event OrganizerProceedsWithdrawn(uint256 indexed eventId, address indexed organizer, address indexed paymentToken, uint256 amount);

    IDojangScroll public immutable dojangScroll;
    bytes32 public immutable dojangAttesterId;
    uint256 public nextEventId = 1;
    uint256 public nextTicketId = 1;

    mapping(address => bool) public approvedOrganizers;
    mapping(uint256 => EventData) private _events;
    mapping(uint256 => TicketData) private _tickets;
    mapping(uint256 => mapping(address => uint256)) public activeTicketOf;
    mapping(uint256 => address[]) private _waitlists;
    mapping(uint256 => mapping(address => bool)) public isQueued;
    mapping(address => mapping(address => uint256)) private _refundCredit; // token => account => amount

    constructor(address dojangScrollAddress, bytes32 attesterId) Ownable(msg.sender) {
        dojangScroll = IDojangScroll(dojangScrollAddress);
        dojangAttesterId = attesterId;
    }

    receive() external payable {}

    function setOrganizerApproval(address organizer, bool approved) external onlyOwner {
        approvedOrganizers[organizer] = approved;
        emit OrganizerApprovalSet(organizer, approved);
    }

    function isOrganizerVerified(address organizer) public view returns (bool) {
        return approvedOrganizers[organizer] && dojangScroll.isVerified(organizer, dojangAttesterId);
    }

    function createEvent(bytes32 metadataHash, address paymentToken, uint96 price, uint40 startsAt, uint40 returnDeadline, uint32 capacity, uint40 claimWindow, bool verifiedOnly) external returns (uint256 eventId) {
        if (capacity == 0) revert InvalidCapacity();
        if (startsAt <= block.timestamp || returnDeadline >= startsAt || returnDeadline <= block.timestamp) revert InvalidSchedule();
        if (claimWindow < 5 minutes || claimWindow > 7 days) revert InvalidClaimWindow();
        eventId = nextEventId++;
        _events[eventId] = EventData({
            organizer: msg.sender, paymentToken: paymentToken, metadataHash: metadataHash, price: price,
            startsAt: startsAt, returnDeadline: returnDeadline, capacity: capacity, activeTickets: 0,
            releasedSeats: 0, queueHead: 0, currentOfferStartedAt: 0, claimWindow: claimWindow,
            verifiedOnly: verifiedOnly, paused: false, cancelled: false, organizerWithdrawn: 0
        });
        emit EventCreated(eventId, msg.sender, metadataHash, paymentToken, price, capacity, verifiedOnly);
    }

    function cancelEvent(uint256 eventId) external {
        EventData storage eventData = _event(eventId);
        if (msg.sender != eventData.organizer) revert NotOrganizer();
        if (eventData.cancelled) revert EventCancelled();
        if (block.timestamp >= eventData.startsAt) revert EventAlreadyStarted();
        eventData.cancelled = true; eventData.paused = true; eventData.currentOfferStartedAt = 0;
        emit EventCancelledSet(eventId, msg.sender);
    }

    function buyTicket(uint256 eventId) external payable nonReentrant returns (uint256 ticketId) {
        EventData storage eventData = _event(eventId);
        _requirePurchasable(eventId, eventData, msg.sender);
        if (eventData.activeTickets >= eventData.capacity) revert EventSoldOut();
        if (eventData.releasedSeats > 0 && _currentQueueAccount(eventId, eventData) != address(0)) revert EventSoldOut();
        _collectPayment(eventData, msg.sender);
        if (eventData.releasedSeats > 0) eventData.releasedSeats -= 1;
        ticketId = _issueTicket(eventId, eventData, msg.sender, false);
    }

    function joinWaitlist(uint256 eventId) external {
        EventData storage eventData = _event(eventId);
        if (eventData.cancelled) revert EventCancelled(); if (eventData.paused) revert EventPaused();
        if (block.timestamp >= eventData.startsAt) revert EventAlreadyStarted();
        if (eventData.activeTickets < eventData.capacity) revert EventNotSoldOut();
        if (activeTicketOf[eventId][msg.sender] != 0) revert AlreadyHasActiveTicket();
        if (isQueued[eventId][msg.sender]) revert AlreadyInQueue();
        _requireVerification(eventData, msg.sender);
        isQueued[eventId][msg.sender] = true; _waitlists[eventId].push(msg.sender);
        emit WaitlistJoined(eventId, msg.sender, _waitlists[eventId].length - 1);
        if (eventData.releasedSeats > 0 && eventData.currentOfferStartedAt == 0) {
            eventData.currentOfferStartedAt = uint40(block.timestamp);
            emit QueueOfferStarted(eventId, _currentQueueAccount(eventId, eventData), block.timestamp + eventData.claimWindow);
        }
    }

    function claimReleasedSeat(uint256 eventId) external payable nonReentrant returns (uint256 ticketId) {
        EventData storage eventData = _event(eventId);
        _requirePurchasable(eventId, eventData, msg.sender);
        if (eventData.releasedSeats == 0) revert NoReleasedSeat();
        if (!isQueued[eventId][msg.sender]) revert NotInQueue();
        if (_currentQueueAccount(eventId, eventData) != msg.sender) revert NotQueueHead();
        if (eventData.currentOfferStartedAt == 0) revert NoReleasedSeat();
        if (block.timestamp > uint256(eventData.currentOfferStartedAt) + eventData.claimWindow) revert OfferExpired();
        _collectPayment(eventData, msg.sender);
        isQueued[eventId][msg.sender] = false; eventData.queueHead += 1; eventData.releasedSeats -= 1;
        ticketId = _issueTicket(eventId, eventData, msg.sender, true);
        _startNextOfferIfNeeded(eventId, eventData);
    }

    function advanceExpiredOffer(uint256 eventId) external {
        EventData storage eventData = _event(eventId);
        if (eventData.cancelled) revert EventCancelled();
        if (eventData.releasedSeats == 0 || eventData.currentOfferStartedAt == 0) revert NoReleasedSeat();
        if (block.timestamp <= uint256(eventData.currentOfferStartedAt) + eventData.claimWindow) revert OfferStillActive();
        address skipped = _currentQueueAccount(eventId, eventData);
        isQueued[eventId][skipped] = false; eventData.queueHead += 1;
        emit QueueOfferSkipped(eventId, skipped); _startNextOfferIfNeeded(eventId, eventData);
    }

    function returnTicket(uint256 ticketId) external nonReentrant {
        TicketData storage ticket = _ticket(ticketId); EventData storage eventData = _event(ticket.eventId);
        if (ticket.holder != msg.sender) revert NotTicketHolder(); if (ticket.status != TicketStatus.Active) revert InvalidTicketState();
        if (eventData.cancelled) revert EventCancelled(); if (block.timestamp > eventData.returnDeadline) revert ReturnWindowClosed();
        ticket.status = TicketStatus.Returned; activeTicketOf[ticket.eventId][msg.sender] = 0;
        eventData.activeTickets -= 1; eventData.releasedSeats += 1;
        _refundCredit[eventData.paymentToken][msg.sender] += eventData.price;
        emit TicketReturned(ticket.eventId, ticketId, msg.sender, eventData.paymentToken, eventData.price);
        _startNextOfferIfNeeded(ticket.eventId, eventData);
    }

    function claimCancellationRefund(uint256 ticketId) external nonReentrant {
        TicketData storage ticket = _ticket(ticketId); EventData storage eventData = _event(ticket.eventId);
        if (!eventData.cancelled) revert EventNotCancelled(); if (ticket.holder != msg.sender) revert NotTicketHolder();
        if (ticket.status != TicketStatus.Active) revert InvalidTicketState();
        ticket.status = TicketStatus.CancelledRefunded; activeTicketOf[ticket.eventId][msg.sender] = 0; eventData.activeTickets -= 1;
        _refundCredit[eventData.paymentToken][msg.sender] += eventData.price;
        emit CancellationRefundClaimed(ticket.eventId, ticketId, msg.sender, eventData.paymentToken, eventData.price);
    }

    function refundCredit(address paymentToken, address account) external view returns (uint256) { return _refundCredit[paymentToken][account]; }

    function withdrawRefund(address paymentToken) external nonReentrant {
        uint256 amount = _refundCredit[paymentToken][msg.sender]; if (amount == 0) revert NothingToWithdraw();
        _refundCredit[paymentToken][msg.sender] = 0; _transferOut(paymentToken, msg.sender, amount);
        emit RefundWithdrawn(msg.sender, paymentToken, amount);
    }

    function checkInWithSignature(uint256 ticketId, uint256 deadline, bytes calldata signature) external {
        TicketData storage ticket = _ticket(ticketId); EventData storage eventData = _event(ticket.eventId);
        if (msg.sender != eventData.organizer) revert NotOrganizer(); if (eventData.cancelled) revert EventCancelled();
        if (ticket.status != TicketStatus.Active) revert InvalidTicketState(); if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 digest = getCheckInDigest(ticketId, ticket.checkInNonce, deadline).toEthSignedMessageHash();
        if (digest.recover(signature) != ticket.holder) revert InvalidCheckInSignature();
        ticket.checkInNonce += 1; ticket.status = TicketStatus.CheckedIn;
        emit TicketCheckedIn(ticket.eventId, ticketId, ticket.holder);
    }

    function withdrawOrganizerProceeds(uint256 eventId) external nonReentrant {
        EventData storage eventData = _event(eventId);
        if (msg.sender != eventData.organizer) revert NotOrganizer(); if (eventData.cancelled) revert EventCancelled();
        if (block.timestamp <= eventData.startsAt) revert EventAlreadyStarted();
        uint256 earned = uint256(eventData.activeTickets) * eventData.price;
        uint256 amount = earned - eventData.organizerWithdrawn; if (amount == 0) revert NothingToWithdraw();
        eventData.organizerWithdrawn += amount; _transferOut(eventData.paymentToken, msg.sender, amount);
        emit OrganizerProceedsWithdrawn(eventId, msg.sender, eventData.paymentToken, amount);
    }

    function setEventPaused(uint256 eventId, bool paused) external {
        EventData storage eventData = _event(eventId); if (msg.sender != eventData.organizer) revert NotOrganizer();
        if (eventData.cancelled) revert EventCancelled(); eventData.paused = paused; emit EventPausedSet(eventId, paused);
    }

    function getEvent(uint256 eventId) external view returns (EventData memory) { return _eventView(eventId); }
    function getTicket(uint256 ticketId) external view returns (TicketData memory) { TicketData memory t=_tickets[ticketId]; if(t.holder==address(0)) revert TicketNotFound(); return t; }
    function getWaitlist(uint256 eventId) external view returns (address[] memory) { _eventView(eventId); return _waitlists[eventId]; }
    function currentQueueAccount(uint256 eventId) external view returns (address) { EventData storage e=_event(eventId); return _currentQueueAccount(eventId,e); }
    function isAddressVerified(address account) external view returns (bool) { return dojangScroll.isVerified(account, dojangAttesterId); }
    function getCheckInDigest(uint256 ticketId, uint64 nonce, uint256 deadline) public view returns (bytes32) { return keccak256(abi.encode(address(this), block.chainid, "RETURNSTILE_CHECK_IN", ticketId, nonce, deadline)); }

    function _collectPayment(EventData storage eventData, address payer) internal {
        if (eventData.paymentToken == address(0)) { if (msg.value != eventData.price) revert IncorrectPayment(); }
        else { if (msg.value != 0) revert IncorrectPayment(); IERC20(eventData.paymentToken).safeTransferFrom(payer, address(this), eventData.price); }
    }
    function _transferOut(address token, address to, uint256 amount) internal {
        if (token == address(0)) { (bool ok,) = payable(to).call{value:amount}(""); if(!ok) revert TransferFailed(); }
        else IERC20(token).safeTransfer(to, amount);
    }
    function _issueTicket(uint256 eventId, EventData storage eventData, address holder, bool fromQueue) internal returns (uint256 ticketId) {
        ticketId=nextTicketId++; _tickets[ticketId]=TicketData(eventId,holder,TicketStatus.Active,0);
        activeTicketOf[eventId][holder]=ticketId; eventData.activeTickets+=1; emit TicketClaimed(eventId,ticketId,holder,fromQueue);
    }
    function _requirePurchasable(uint256 eventId, EventData storage eventData, address account) internal view {
        if(eventData.cancelled) revert EventCancelled(); if(eventData.paused) revert EventPaused();
        if(block.timestamp>=eventData.startsAt) revert EventAlreadyStarted(); if(activeTicketOf[eventId][account]!=0) revert AlreadyHasActiveTicket();
        _requireVerification(eventData,account);
    }
    function _requireVerification(EventData storage eventData,address account) internal view { if(eventData.verifiedOnly&&!dojangScroll.isVerified(account,dojangAttesterId)) revert NotVerified(); }
    function _startNextOfferIfNeeded(uint256 eventId, EventData storage eventData) internal {
        if(eventData.cancelled||eventData.releasedSeats==0||eventData.queueHead>=_waitlists[eventId].length){eventData.currentOfferStartedAt=0;return;}
        eventData.currentOfferStartedAt=uint40(block.timestamp); emit QueueOfferStarted(eventId,_currentQueueAccount(eventId,eventData),block.timestamp+eventData.claimWindow);
    }
    function _currentQueueAccount(uint256 eventId,EventData storage eventData) internal view returns(address){if(eventData.queueHead>=_waitlists[eventId].length)return address(0);return _waitlists[eventId][eventData.queueHead];}
    function _event(uint256 eventId) internal view returns(EventData storage eventData){eventData=_events[eventId];if(eventData.organizer==address(0))revert EventNotFound();}
    function _eventView(uint256 eventId) internal view returns(EventData memory eventData){eventData=_events[eventId];if(eventData.organizer==address(0))revert EventNotFound();}
    function _ticket(uint256 ticketId) internal view returns(TicketData storage ticket){ticket=_tickets[ticketId];if(ticket.holder==address(0))revert TicketNotFound();}
}
