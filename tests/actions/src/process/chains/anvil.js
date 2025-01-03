import { killProcess, runProcess } from '@test/process/manage';
/**
 * Runs `sanvil` in silent mode in the background
 */
const runSanvil = async (options = {}) => {
    const { port = 8545, silent = true, waitMs = 2000 } = options;
    const silentArg = silent ? ['--silent'] : [];
    const sanvilProcess = await runProcess('sanvil', {
        args: ['--port', port.toString(), ...silentArg],
        waitMs,
    });
    // Check if process is running by verifying the URL is accessible, etc.
    try {
        return { process: sanvilProcess, url: `http://127.0.0.1:${port}` };
    }
    catch (e) {
        await killProcess(sanvilProcess);
        throw new Error(`Failed to start seismic-anvil: ${e}`);
    }
};
export const setupAnvilNode = async () => {
    const anvilProcess = await runSanvil({ silent: true });
    const nodeUrl = anvilProcess.url;
    const exitProcess = async (code) => {
        await killProcess(anvilProcess.process);
        process.exit(code);
    };
    return {
        url: nodeUrl,
        exitProcess,
    };
};
//# sourceMappingURL=anvil.js.map