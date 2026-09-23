import { describe, expect, it } from 'vitest';
import { runProcess } from '../src/process.ts';

const NODE = process.execPath;
const script = (corps: string) => ['-e', corps];

describe('runProcess', () => {
  it('capture stdout', async () => {
    const { code, stdout, stderr } = await runProcess(
      NODE,
      script('process.stdout.write("bonjour")'),
    );
    expect(code).toBe(0);
    expect(stdout).toBe('bonjour');
    expect(stderr).toBe('');
  });

  it('capture stderr', async () => {
    const { code, stdout, stderr } = await runProcess(
      NODE,
      script('process.stderr.write("probleme")'),
    );
    expect(code).toBe(0);
    expect(stdout).toBe('');
    expect(stderr).toBe('probleme');
  });

  it('rend le code de sortie non nul', async () => {
    const { code } = await runProcess(NODE, script('process.exit(7)'));
    expect(code).toBe(7);
  });

  it('capture stdout et stderr meme en cas d echec', async () => {
    const { code, stdout, stderr } = await runProcess(
      NODE,
      script('process.stdout.write("partiel"); process.stderr.write("cause"); process.exit(2)'),
    );
    expect(code).toBe(2);
    expect(stdout).toBe('partiel');
    expect(stderr).toBe('cause');
  });

  it('transmet stdin en UTF-8', async () => {
    const texte = "L'été à Genève, ça vaut le cœur d'un fêtard ’";
    const { stdout } = await runProcess(
      NODE,
      script(
        'const e = require("fs").readFileSync(0, "utf8");' +
          'process.stdout.write(JSON.stringify({ texte: e, octets: Buffer.byteLength(e, "utf8") }))',
      ),
      { input: texte },
    );
    const recu: unknown = JSON.parse(stdout);
    expect(recu).toEqual({ texte, octets: Buffer.byteLength(texte, 'utf8') });
    expect(Buffer.byteLength(texte, 'utf8')).toBeGreaterThan(texte.length);
  });

  it('ferme stdin quand aucune entree n est fournie', async () => {
    const { code, stdout } = await runProcess(
      NODE,
      script('process.stdout.write(String(require("fs").readFileSync(0, "utf8").length))'),
    );
    expect(code).toBe(0);
    expect(stdout).toBe('0');
  });

  it('applique un environnement personnalise', async () => {
    const { stdout } = await runProcess(
      NODE,
      script('process.stdout.write(process.env.TRENDFORGE_TEST ?? "absent")'),
      { env: { ...process.env, TRENDFORGE_TEST: 'present' } },
    );
    expect(stdout).toBe('present');
  });

  it('herite de l environnement courant par defaut', async () => {
    const { stdout } = await runProcess(
      NODE,
      script('process.stdout.write(process.env.PATH === undefined ? "sans" : "avec")'),
    );
    expect(stdout).toBe('avec');
  });

  it('transmet les arguments sans interpretation par un shell', async () => {
    const piege = 'a && echo pirate; $(echo x) | y > z';
    const { stdout } = await runProcess(NODE, [
      '-e',
      'process.stdout.write(process.argv[1] ?? "")',
      piege,
    ]);
    expect(stdout).toBe(piege);
  });

  it('signale une commande introuvable', async () => {
    await expect(runProcess('commande-inexistante-trendforge', ['-v'])).rejects.toThrow(
      'commande-inexistante-trendforge introuvable ou non executable',
    );
  });
});
