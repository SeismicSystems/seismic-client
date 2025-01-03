import { Chain } from 'viem/chains';
import { ServerProcess } from '@test/process/manage';
export type NodeProcessOptions = {
    port?: number;
    silent?: boolean;
    waitMs?: number;
};
export type NodeProcess = ServerProcess & {
    url: string;
};
export type SpawnedNode = {
    url: string;
    exitProcess: (code: 0 | 1) => void;
};
export declare const envChain: () => Chain;
export declare const setupNode: (chain: Chain) => Promise<SpawnedNode>;
