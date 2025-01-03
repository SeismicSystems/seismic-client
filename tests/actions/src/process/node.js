import { anvil } from 'viem/chains';
import { seismicChain } from '@actions/chain';
import { setupAnvilNode } from '@test/process/chains/anvil';
import { setupRethNode } from '@test/process/chains/reth';
var ChainName;
(function (ChainName) {
    ChainName["Anvil"] = "anvil";
    ChainName["Devnet"] = "devnet";
})(ChainName || (ChainName = {}));
const nameToChain = (name) => {
    switch (name) {
        case ChainName.Anvil:
            return anvil;
        case ChainName.Devnet:
            return seismicChain;
        default:
            throw new Error(`Unable to map ${name} to Chain`);
    }
};
export const envChain = () => {
    const chainName = process.env.CHAIN;
    if (!Object.values(ChainName).includes(chainName)) {
        throw new Error(`BACKEND env variable must be either "anvil" or "reth"`);
    }
    return nameToChain(chainName);
};
export const setupNode = async (chain) => {
    switch (chain.id) {
        case anvil.id:
            return setupAnvilNode();
        case seismicChain.id:
            return setupRethNode();
        default:
            throw new Error(`Unable to map Chain ${chain.id} to Backend`);
    }
};
//# sourceMappingURL=node.js.map