import { spawn } from 'node:child_process';

export type ProcessResult = { code: number | null; stdout: string; stderr: string };

export type ProcessOptions = { input?: string; env?: NodeJS.ProcessEnv };

export const runProcess = (
  command: string,
  args: readonly string[],
  options: ProcessOptions = {},
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      windowsHide: true,
      env: options.env ?? process.env,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error: Error) => {
      reject(new Error(`${command} introuvable ou non executable : ${error.message}`));
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(options.input ?? '', 'utf8');
  });
