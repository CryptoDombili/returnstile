import {
  createWalletClient, custom, formatEther, formatUnits, isAddress, keccak256,
  parseEther, parseEventLogs, parseUnits, toBytes, zeroAddress,
  type Address, type Hash,
} from 'viem';
import { giwaSepolia, publicClient } from './giwa';

export const RETURNSTILE_ADDRESS = import.meta.env.VITE_RETURNSTILE_CONTRACT_ADDRESS as Address | undefined;
const rawUsdc = import.meta.env.VITE_USDC_ADDRESS as string | undefined;
const rawUsdt = import.meta.env.VITE_USDT_ADDRESS as string | undefined;
export const USDC_ADDRESS = rawUsdc && isAddress(rawUsdc) ? rawUsdc as Address : null;
export const USDT_ADDRESS = rawUsdt && isAddress(rawUsdt) ? rawUsdt as Address : null;
export type PaymentAsset = 'ETH' | 'USDC' | 'USDT';
export type RefundBalance = { asset: PaymentAsset; token: Address; amount: bigint; formatted: string };

const erc20Abi = [
  { type:'function', name:'allowance', stateMutability:'view', inputs:[{name:'owner',type:'address'},{name:'spender',type:'address'}], outputs:[{name:'',type:'uint256'}] },
  { type:'function', name:'approve', stateMutability:'nonpayable', inputs:[{name:'spender',type:'address'},{name:'amount',type:'uint256'}], outputs:[{name:'',type:'bool'}] },
] as const;

export const returnstileAbi = [
  { type:'event', name:'EventCreated', anonymous:false, inputs:[
    {name:'eventId',type:'uint256',indexed:true},{name:'organizer',type:'address',indexed:true},{name:'metadataHash',type:'bytes32',indexed:true},
    {name:'paymentToken',type:'address',indexed:false},{name:'price',type:'uint256',indexed:false},{name:'capacity',type:'uint256',indexed:false},{name:'verifiedOnly',type:'bool',indexed:false},
  ]},
  { type:'function', name:'createEvent', stateMutability:'nonpayable', inputs:[
    {name:'metadataHash',type:'bytes32'},{name:'paymentToken',type:'address'},{name:'price',type:'uint96'},
    {name:'startsAt',type:'uint40'},{name:'returnDeadline',type:'uint40'},{name:'capacity',type:'uint32'},
    {name:'claimWindow',type:'uint40'},{name:'verifiedOnly',type:'bool'}], outputs:[{name:'eventId',type:'uint256'}]},
  { type:'function', name:'buyTicket', stateMutability:'payable', inputs:[{name:'eventId',type:'uint256'}], outputs:[{name:'ticketId',type:'uint256'}]},
  { type:'function', name:'joinWaitlist', stateMutability:'nonpayable', inputs:[{name:'eventId',type:'uint256'}], outputs:[]},
  { type:'function', name:'returnTicket', stateMutability:'nonpayable', inputs:[{name:'ticketId',type:'uint256'}], outputs:[]},
  { type:'function', name:'cancelEvent', stateMutability:'nonpayable', inputs:[{name:'eventId',type:'uint256'}], outputs:[]},
  { type:'function', name:'claimCancellationRefund', stateMutability:'nonpayable', inputs:[{name:'ticketId',type:'uint256'}], outputs:[]},
  { type:'function', name:'setOrganizerApproval', stateMutability:'nonpayable', inputs:[{name:'organizer',type:'address'},{name:'approved',type:'bool'}], outputs:[]},
  { type:'function', name:'isOrganizerVerified', stateMutability:'view', inputs:[{name:'organizer',type:'address'}], outputs:[{name:'',type:'bool'}]},
  { type:'function', name:'approvedOrganizers', stateMutability:'view', inputs:[{name:'organizer',type:'address'}], outputs:[{name:'',type:'bool'}]},
  { type:'function', name:'owner', stateMutability:'view', inputs:[], outputs:[{name:'',type:'address'}]},
  { type:'function', name:'withdrawRefund', stateMutability:'nonpayable', inputs:[{name:'paymentToken',type:'address'}], outputs:[]},
  { type:'function', name:'nextEventId', stateMutability:'view', inputs:[], outputs:[{name:'',type:'uint256'}]},
  { type:'function', name:'activeTicketOf', stateMutability:'view', inputs:[{name:'eventId',type:'uint256'},{name:'account',type:'address'}], outputs:[{name:'',type:'uint256'}]},
  { type:'function', name:'refundCredit', stateMutability:'view', inputs:[{name:'paymentToken',type:'address'},{name:'account',type:'address'}], outputs:[{name:'',type:'uint256'}]},
  { type:'function', name:'getEvent', stateMutability:'view', inputs:[{name:'eventId',type:'uint256'}], outputs:[{name:'',type:'tuple',components:[
    {name:'organizer',type:'address'},{name:'paymentToken',type:'address'},{name:'metadataHash',type:'bytes32'},{name:'price',type:'uint96'},
    {name:'startsAt',type:'uint40'},{name:'returnDeadline',type:'uint40'},{name:'capacity',type:'uint32'},{name:'activeTickets',type:'uint32'},
    {name:'releasedSeats',type:'uint32'},{name:'queueHead',type:'uint32'},{name:'currentOfferStartedAt',type:'uint40'},{name:'claimWindow',type:'uint40'},
    {name:'verifiedOnly',type:'bool'},{name:'paused',type:'bool'},{name:'cancelled',type:'bool'},{name:'organizerWithdrawn',type:'uint256'},
  ]}]},
] as const;

export type CreateEventInput = {
  title:string; venue:string; startsAt:string; returnDeadline:string; capacity:number;
  price:string; paymentAsset:PaymentAsset; claimWindowMinutes:number; verifiedOnly:boolean; imageUrl:string;
};
export type OnchainEvent = {
  id:number; title:string; venue:string; startsAt:number; returnDeadline:number; capacity:number; activeTickets:number;
  releasedSeats:number; priceWei:bigint; paymentToken:Address; paymentAsset:PaymentAsset; paymentDecimals:number;
  verifiedOnly:boolean; paused:boolean; organizer:Address; organizerVerified:boolean; cancelled:boolean;
  metadataHash:`0x${string}`; imageUrl?:string;
};
export type AccountPass = {
  ticketId:bigint; eventId:number; title:string; venue:string; date:string; imageUrl?:string;
  returnDeadline:number; priceWei:bigint; paymentAsset:PaymentAsset; cancelled:boolean;
};

type StoredMetadata = Record<string,{title:string;venue:string;imageUrl?:string}>;
const METADATA_STORAGE_KEY='returnstile:event-metadata:v1';
function readStoredMetadata():StoredMetadata{try{return JSON.parse(localStorage.getItem(METADATA_STORAGE_KEY)??'{}') as StoredMetadata}catch{return{}}}
function saveStoredMetadata(eventId:bigint,input:CreateEventInput){const m=readStoredMetadata();m[eventId.toString()]={title:input.title.trim(),venue:input.venue.trim(),imageUrl:input.imageUrl.trim()||undefined};localStorage.setItem(METADATA_STORAGE_KEY,JSON.stringify(m));}
function walletClient(account:Address){if(!window.ethereum)throw new Error('No injected wallet found.');return createWalletClient({account,chain:giwaSepolia,transport:custom(window.ethereum)});}

function tokenDetails(token:Address):{asset:PaymentAsset;decimals:number}{
  if(token.toLowerCase()===zeroAddress)return{asset:'ETH',decimals:18};
  if(USDC_ADDRESS&&token.toLowerCase()===USDC_ADDRESS.toLowerCase())return{asset:'USDC',decimals:6};
  if(USDT_ADDRESS&&token.toLowerCase()===USDT_ADDRESS.toLowerCase())return{asset:'USDT',decimals:6};
  return{asset:'USDC',decimals:6};
}
function paymentToken(asset:PaymentAsset):Address{
  if(asset==='ETH')return zeroAddress;
  const token=asset==='USDC'?USDC_ADDRESS:USDT_ADDRESS;
  if(!token)throw new Error(`${asset} address is missing from .env / Vercel.`);
  return token;
}
export function availablePaymentAssets():PaymentAsset[]{return ['ETH',...(USDC_ADDRESS?['USDC' as const]:[]),...(USDT_ADDRESS?['USDT' as const]:[])];}
export function formatOnchainEventDate(timestamp:number){return new Intl.DateTimeFormat('en',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(timestamp*1000)).toUpperCase().replace(',',' ·');}
export function formatOnchainPrice(amount:bigint,asset:PaymentAsset){if(amount===0n)return'FREE';const decimals=asset==='ETH'?18:6;return`${Number(formatUnits(amount,decimals)).toLocaleString(undefined,{maximumFractionDigits:6})} ${asset}`;}

export async function readReturnstileEvents():Promise<OnchainEvent[]>{
  if(!RETURNSTILE_ADDRESS)return[];
  const next=await publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'nextEventId'});
  const count=Number(next-1n);if(count<=0)return[];const stored=readStoredMetadata();
  const events=await Promise.all(Array.from({length:count},async(_,index)=>{
    const eventId=BigInt(index+1);const d=await publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'getEvent',args:[eventId]});
    const meta=stored[eventId.toString()];const td=tokenDetails(d.paymentToken);
    return {id:Number(eventId),title:meta?.title??`Onchain Event #${eventId}`,venue:meta?.venue??`Organizer ${d.organizer.slice(0,6)}…${d.organizer.slice(-4)}`,
      startsAt:Number(d.startsAt),returnDeadline:Number(d.returnDeadline),capacity:Number(d.capacity),activeTickets:Number(d.activeTickets),releasedSeats:Number(d.releasedSeats),
      priceWei:d.price,paymentToken:d.paymentToken,paymentAsset:td.asset,paymentDecimals:td.decimals,verifiedOnly:d.verifiedOnly,paused:d.paused,cancelled:d.cancelled,
      organizer:d.organizer,organizerVerified:await publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'isOrganizerVerified',args:[d.organizer]}),
      metadataHash:d.metadataHash,imageUrl:meta?.imageUrl} satisfies OnchainEvent;
  }));return events.reverse();
}
export async function readAccountPasses(account:Address):Promise<AccountPass[]>{
  const events=await readReturnstileEvents();if(!RETURNSTILE_ADDRESS)return[];
  const rows=await Promise.all(events.map(async event=>{const ticketId=await publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'activeTicketOf',args:[BigInt(event.id),account]});if(ticketId===0n)return null;const pass:AccountPass={ticketId,eventId:event.id,title:event.title,venue:event.venue,date:formatOnchainEventDate(event.startsAt),returnDeadline:event.returnDeadline,priceWei:event.priceWei,paymentAsset:event.paymentAsset,cancelled:event.cancelled};if(event.imageUrl)pass.imageUrl=event.imageUrl;return pass;}));
  const passes:AccountPass[]=[];
  // Cancelled events are intentionally omitted from My Passes.
  // Refund handling remains available through the account/refund flow.
  for(const row of rows)if(row&&!row.cancelled)passes.push(row);
  return passes;
}
export async function readRefundCredits(account:Address):Promise<RefundBalance[]>{
  if(!RETURNSTILE_ADDRESS)return[];const tokens:[PaymentAsset,Address,number][]=[['ETH',zeroAddress,18],...(USDC_ADDRESS?[['USDC',USDC_ADDRESS,6] as [PaymentAsset,Address,number]]:[]),...(USDT_ADDRESS?[['USDT',USDT_ADDRESS,6] as [PaymentAsset,Address,number]]:[])];
  const balances=await Promise.all(tokens.map(async([asset,token,decimals])=>{const amount=await publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'refundCredit',args:[token,account]});return{asset,token,amount,formatted:formatUnits(amount,decimals)};}));return balances;
}
async function ensureAllowance(account:Address,token:Address,amount:bigint){if(!RETURNSTILE_ADDRESS||amount===0n)return;const allowance=await publicClient.readContract({address:token,abi:erc20Abi,functionName:'allowance',args:[account,RETURNSTILE_ADDRESS]});if(allowance>=amount)return;const hash=await walletClient(account).writeContract({address:token,abi:erc20Abi,functionName:'approve',args:[RETURNSTILE_ADDRESS,amount]});await publicClient.waitForTransactionReceipt({hash});}
export async function buyReturnstileTicket(account:Address,eventId:number,price:bigint,token:Address):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');if(token!==zeroAddress)await ensureAllowance(account,token,price);const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'buyTicket',args:[BigInt(eventId)],value:token===zeroAddress?price:0n});await publicClient.waitForTransactionReceipt({hash});return hash;}
export async function joinReturnstileWaitlist(account:Address,eventId:number):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'joinWaitlist',args:[BigInt(eventId)]});await publicClient.waitForTransactionReceipt({hash});return hash;}
export async function returnReturnstileTicket(account:Address,ticketId:bigint):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'returnTicket',args:[ticketId]});await publicClient.waitForTransactionReceipt({hash});return hash;}
export async function withdrawReturnstileRefund(account:Address,token:Address):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'withdrawRefund',args:[token]});await publicClient.waitForTransactionReceipt({hash});return hash;}
export async function createReturnstileEvent(account:Address,input:CreateEventInput):Promise<{hash:Hash;eventId:bigint}>{
  if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const startsAt=Math.floor(new Date(input.startsAt).getTime()/1000);const returnDeadline=Math.floor(new Date(input.returnDeadline).getTime()/1000);const now=Math.floor(Date.now()/1000);
  if(!Number.isFinite(startsAt)||!Number.isFinite(returnDeadline))throw new Error('Choose valid dates.');if(returnDeadline<=now)throw new Error('Return deadline must be in the future.');if(startsAt<=returnDeadline)throw new Error('Event must start after the return deadline.');if(input.capacity<1)throw new Error('Capacity must be at least 1.');if(input.claimWindowMinutes<5)throw new Error('Claim window must be at least 5 minutes.');
  const token=paymentToken(input.paymentAsset);const decimals=input.paymentAsset==='ETH'?18:6;const amount=input.paymentAsset==='ETH'?parseEther(input.price||'0'):parseUnits(input.price||'0',decimals);
  const metadataHash=keccak256(toBytes(JSON.stringify({title:input.title.trim(),venue:input.venue.trim(),imageUrl:input.imageUrl.trim()||undefined,paymentAsset:input.paymentAsset,version:4})));
  const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'createEvent',args:[metadataHash,token,amount,startsAt,returnDeadline,input.capacity,input.claimWindowMinutes*60,input.verifiedOnly]});
  const receipt=await publicClient.waitForTransactionReceipt({hash});const logs=parseEventLogs({abi:returnstileAbi,logs:receipt.logs,eventName:'EventCreated'});const eventId=logs[0]?.args.eventId;if(eventId===undefined)throw new Error('Event was created but its ID could not be read.');saveStoredMetadata(eventId,input);return{hash,eventId};
}
export async function cancelReturnstileEvent(account:Address,eventId:number):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'cancelEvent',args:[BigInt(eventId)]});await publicClient.waitForTransactionReceipt({hash});return hash;}
export async function claimCancellationRefund(account:Address,ticketId:bigint):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'claimCancellationRefund',args:[ticketId]});await publicClient.waitForTransactionReceipt({hash});return hash;}
export async function readProtocolOwner():Promise<Address|null>{if(!RETURNSTILE_ADDRESS)return null;return publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'owner'});}
export async function readOrganizerAdminApproval(organizer:Address):Promise<boolean>{if(!RETURNSTILE_ADDRESS)return false;return publicClient.readContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'approvedOrganizers',args:[organizer]});}
export async function setOrganizerApproval(account:Address,organizer:Address,approved:boolean):Promise<Hash>{if(!RETURNSTILE_ADDRESS)throw new Error('Contract address is missing.');const hash=await walletClient(account).writeContract({address:RETURNSTILE_ADDRESS,abi:returnstileAbi,functionName:'setOrganizerApproval',args:[organizer,approved]});await publicClient.waitForTransactionReceipt({hash});return hash;}
