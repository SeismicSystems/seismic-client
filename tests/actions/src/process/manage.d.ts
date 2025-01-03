import type { ChildProcess } from 'node:child_process';
export type ServerProcess = {
    process: ChildProcess;
};
type RunProcessOptions = {
    args?: readonly string[];
    waitMs?: number;
    cwd?: string;
};
/**
 * Runs a process
 */
export declare const runProcess: (command: string, options?: RunProcessOptions) => Promise<ChildProcess>;
/**
 * Kills a process
 */
export declare const killProcess: (process: ChildProcess) => Promise<void>;
export {};
