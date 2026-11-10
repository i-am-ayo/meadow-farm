export const rewardTypes={Reward:[{name:'player',type:'address'},{name:'day',type:'uint64'},{name:'stage',type:'uint8'},{name:'nonce',type:'uint64'},{name:'bonusMask',type:'uint8'},{name:'completedAt',type:'uint64'},{name:'roundId',type:'bytes32'},{name:'careerHash',type:'bytes32'}]};
export const checkpointTypes={Checkpoint:[{name:'player',type:'address'},{name:'careerHash',type:'bytes32'},{name:'issuedAt',type:'uint64'}]};
export const domain=config=>({name:'Meadow Farm',version:'1',chainId:11155111,verifyingContract:config.game});
