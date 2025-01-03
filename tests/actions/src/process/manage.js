import { spawn } from 'node:child_process';
import terminate from 'terminate/promise';
/**
 * Runs a process
 */
export const runProcess = async (command, options = {}) => {
    const { args = [], waitMs = 100, cwd } = options;
    const process = spawn(command, args, {
        cwd,
        stdio: 'inherit',
    });
    await new Promise((resolve) => {
        process.on('spawn', () => setTimeout(resolve, waitMs));
    });
    return process;
};
/**
 * Kills a process
 */
export const killProcess = async (process) => {
    const description = process.spawnargs.join(' ');
    if (!process.pid) {
        console.warn(`Cannot kill '${description}': has no pid`);
        return;
    }
    try {
        await terminate(process.pid);
        console.info(`Terminated process '${description}'`);
    }
    catch (error) {
        console.error(`Process[${process.pid}] failed to terminate '${description}': ${error}`);
    }
};
//# sourceMappingURL=manage.js.map