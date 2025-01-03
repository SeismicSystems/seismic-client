import { getContractAddress } from 'viem';
export const stringifyBigInt = (_, v) => typeof v === 'bigint' ? v.toString() : v;
export const getDeployedAddress = async (publicClient, address) => {
    const nonce = BigInt(await publicClient.getTransactionCount({
        address: address,
    }));
    const deployedAddress = getContractAddress({
        from: address,
        nonce: nonce - BigInt(1),
    });
    return deployedAddress;
};
//# sourceMappingURL=utils.js.map