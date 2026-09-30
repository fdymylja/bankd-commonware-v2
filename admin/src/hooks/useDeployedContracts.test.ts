import assert from 'node:assert/strict'
import test from 'node:test'

import { enrichContractInventory, validateContractInventory } from './useDeployedContracts'
const wallet='0x00000000000000000000000000000000000000AA' as const
const valid={contracts:[{address:wallet,deployer:wallet,txHash:'0x1',blockNumber:1}],identity:{wallet,chainId:9001},provenance:{source:'Shinzo',signerIds:['one','two'],requiredSigners:2,latestHeight:1,latestHash:'0x1',latestTime:'now',indexedStartHeight:0,rpcAgreement:true,collectionPrefix:'X'},coverage:{complete:true,indexedRangeComplete:true,truncated:false},limitations:{topLevelCreate:true,internalCreate:false,create2:false,ownershipNotEstablished:true}}
test('rejects malformed contract inventory responses',()=>{ assert.throws(()=>validateContractInventory({contracts:[],identity:{chainId:'9001'}}),/Malformed/); assert.throws(()=>validateContractInventory({...valid,provenance:{...valid.provenance,rpcAgreement:false}}),/Malformed/) })
test('performs no RPC enrichment when inventory chain mismatches',async()=>{let calls=0;const operations={getCode:async()=>{calls++;return '0x12' as const},read:async()=>{calls++;return ''}};await assert.rejects(enrichContractInventory(valid,9002,operations),/does not match/);assert.equal(calls,0)})
test('enriches only an agreed matching-chain response',async()=>{let calls=0;const operations={getCode:async()=>{calls++;return undefined},read:async()=>{calls++;return ''}};const result=await enrichContractInventory(valid,9001,operations);assert.equal(result.contracts[0].hasCode,false);assert.equal(calls,1)})
