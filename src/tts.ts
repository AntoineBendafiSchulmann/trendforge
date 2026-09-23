import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { piperSynthesisSchema, type PiperSynthesis } from './captions.ts';

const PIPER_PYTHON = path.resolve(
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);
const PIPER_SCRIPT = path.resolve('tools/piper_synth.py');
const PIPER_MODEL = path.resolve('models/piper/fr_FR-siwis-medium/fr_FR-siwis-medium.onnx');
const PIPER_CONFIG = `${PIPER_MODEL}.json`;
const PIPER_ENV: NodeJS.ProcessEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };

type RunResult = { code: number | null; stdout: string; stderr: string };

const run = (
  command: string,
  args: readonly string[],
  input?: string,
  env?: NodeJS.ProcessEnv,
): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { windowsHide: true, env: env ?? process.env });
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

    child.stdin.end(input ?? '', 'utf8');
  });

const requireFile = async (file: string, label: string): Promise<void> => {
  const info = await stat(file).catch(() => null);
  if (info === null || !info.isFile()) {
    throw new Error(`${label} introuvable : ${file}`);
  }
};

export const ensureTooling = async (): Promise<void> => {
  await requireFile(PIPER_PYTHON, "Python de l'environnement .venv");
  await requireFile(PIPER_SCRIPT, 'Script de synthese Piper');
  await requireFile(PIPER_MODEL, 'Modele Piper');
  await requireFile(PIPER_CONFIG, 'Configuration du modele Piper');

  const piper = await run(PIPER_PYTHON, ['-c', 'import piper, onnx']);
  if (piper.code !== 0) {
    throw new Error(
      `piper-tts[alignment] indisponible dans .venv (code ${piper.code}) : ${piper.stderr.trim()}`,
    );
  }

  for (const tool of ['ffmpeg', 'ffprobe']) {
    const { code } = await run(tool, ['-version']);
    if (code !== 0) {
      throw new Error(`${tool} indisponible (code ${code}). FFmpeg doit etre dans le PATH.`);
    }
  }
};

const EXCERPT_LIMIT = 200;

const excerpt = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > EXCERPT_LIMIT ? `${trimmed.slice(0, EXCERPT_LIMIT)}[...]` : trimmed;
};

const providerContext = (stdout: string, stderr: string): string => {
  const parts = [`stdout (${stdout.length} octets) : ${JSON.stringify(excerpt(stdout))}`];
  if (stderr.trim() !== '') parts.push(`stderr : ${JSON.stringify(excerpt(stderr))}`);
  return parts.join(' | ');
};

export const speak = async (text: string, outputPath: string): Promise<PiperSynthesis> => {
  const { code, stdout, stderr } = await run(
    PIPER_PYTHON,
    [PIPER_SCRIPT, '--model', PIPER_MODEL, '--output', outputPath],
    text,
    PIPER_ENV,
  );
  if (code !== 0) {
    throw new Error(`Piper a echoue (code ${code}) : ${stderr.trim()}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Piper : sortie JSON illisible. ${providerContext(stdout, stderr)}`, {
      cause: error,
    });
  }

  const parsed = piperSynthesisSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where =
      issue === undefined ? 'cause inconnue' : `${issue.path.join('.')} : ${issue.message}`;
    throw new Error(`Piper : sortie invalide (${where}). ${providerContext(stdout, stderr)}`, {
      cause: parsed.error,
    });
  }

  return parsed.data;
};

export const normalizeLoudness = async (input: string, output: string): Promise<void> => {
  const { code, stderr } = await run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    input,
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ar',
    '22050',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    output,
  ]);
  if (code !== 0) {
    throw new Error(`ffmpeg a echoue (code ${code}) : ${stderr.trim()}`);
  }
};

export const audioDurationInSeconds = async (file: string): Promise<number> => {
  const { code, stdout, stderr } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nw=1:nk=1',
    file,
  ]);
  if (code !== 0) {
    throw new Error(`ffprobe a echoue sur ${file} (code ${code}) : ${stderr.trim()}`);
  }

  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Duree audio invalide pour ${file} : ${JSON.stringify(stdout.trim())}`);
  }
  return seconds;
};
