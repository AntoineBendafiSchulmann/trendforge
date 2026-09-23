import { copyFile, link, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const WINDOWS = process.platform === 'win32';
const DEPART = process.cwd();

type FauxProjet = { racine: string; sortie: string };

const fauxProjet = async (options: { script?: string; python?: boolean }): Promise<FauxProjet> => {
  const racine = await mkdtemp(path.join(tmpdir(), 'tf-tts-'));
  await writeFile(path.join(racine, 'package.json'), JSON.stringify({ type: 'commonjs' }));

  if (options.python !== false) {
    const dossier = path.join(racine, '.venv', WINDOWS ? 'Scripts' : 'bin');
    await mkdir(dossier, { recursive: true });
    const python = path.join(dossier, WINDOWS ? 'python.exe' : 'python');
    // Node joue le role de l'interpreteur : le faux script est du CommonJS.
    await link(process.execPath, python).catch(() => copyFile(process.execPath, python));
  }

  if (options.script !== undefined) {
    await mkdir(path.join(racine, 'tools'), { recursive: true });
    await writeFile(path.join(racine, 'tools', 'piper_synth.py'), options.script);
  }

  return { racine, sortie: path.join(racine, 'scene.wav') };
};

const chargerTts = async (racine: string) => {
  process.chdir(racine);
  vi.resetModules();
  return import('../src/tts.ts');
};

const nettoyer = async (racine: string) => {
  process.chdir(DEPART);
  await rm(racine, { recursive: true, force: true }).catch(() => undefined);
};

const scriptQui = (corps: string) =>
  `const entree = require("fs").readFileSync(0, "utf8");\n${corps}\n`;

const RAPPORTE_LE_TEXTE = scriptQui(
  'process.stdout.write(JSON.stringify({ sampleRate: 22050, alignments: [' +
    '{ phoneme: "^", numSamples: 100 },' +
    '{ phoneme: "texte", numSamples: Buffer.byteLength(entree, "utf8") },' +
    '{ phoneme: "$", numSamples: 50 }] }));',
);

afterEach(() => {
  process.chdir(DEPART);
  vi.resetModules();
});

describe('speak : cas nominal', () => {
  const TEXTE = "L'été à Genève, ça vaut le cœur d'un fêtard ’";

  it('transmet le texte par stdin et rend un resultat valide', async () => {
    const { racine, sortie } = await fauxProjet({ script: RAPPORTE_LE_TEXTE });
    try {
      const { speak } = await chargerTts(racine);
      const resultat = await speak(TEXTE, sortie);

      expect(resultat.sampleRate).toBe(22050);
      expect(resultat.alignments).toHaveLength(3);
      expect(resultat.alignments[1]?.phoneme).toBe('texte');
    } finally {
      await nettoyer(racine);
    }
  });

  it('conserve les accents et l apostrophe typographique en UTF-8', async () => {
    const { racine, sortie } = await fauxProjet({ script: RAPPORTE_LE_TEXTE });
    try {
      const { speak } = await chargerTts(racine);
      const resultat = await speak(TEXTE, sortie);
      // Le faux provider renvoie la taille UTF-8 exacte de ce qu'il a recu.
      expect(resultat.alignments[1]?.numSamples).toBe(Buffer.byteLength(TEXTE, 'utf8'));
      expect(Buffer.byteLength(TEXTE, 'utf8')).toBeGreaterThan(TEXTE.length);
    } finally {
      await nettoyer(racine);
    }
  });

  it('passe le modele et la sortie en arguments', async () => {
    const script = scriptQui(
      'const args = process.argv.slice(2);' +
        'process.stdout.write(JSON.stringify({ sampleRate: 22050, alignments: [' +
        '{ phoneme: args.join(" "), numSamples: 1 }] }));',
    );
    const { racine, sortie } = await fauxProjet({ script });
    try {
      const { speak } = await chargerTts(racine);
      const resultat = await speak('bonjour', sortie);
      const args = resultat.alignments[0]?.phoneme ?? '';
      expect(args).toContain('--model');
      expect(args).toContain('--output');
      expect(args).toContain(sortie);
    } finally {
      await nettoyer(racine);
    }
  });
});

describe('speak : chemins d erreur', () => {
  it('signale un code de sortie non nul avec le stderr', async () => {
    const script = scriptQui('process.stderr.write("modele introuvable"); process.exit(3);');
    const { racine, sortie } = await fauxProjet({ script });
    try {
      const { speak } = await chargerTts(racine);
      await expect(speak('bonjour', sortie)).rejects.toThrow('Piper a echoue (code 3)');
      await expect(speak('bonjour', sortie)).rejects.toThrow('modele introuvable');
    } finally {
      await nettoyer(racine);
    }
  });

  it('signale une sortie JSON illisible avec le contexte', async () => {
    const script = scriptQui(
      'process.stderr.write("avertissement onnxruntime"); process.stdout.write("pas du json");',
    );
    const { racine, sortie } = await fauxProjet({ script });
    try {
      const { speak } = await chargerTts(racine);
      const erreur = await speak('bonjour', sortie).catch((cause: unknown) => cause);
      const message = String(erreur);
      expect(message).toContain('sortie JSON illisible');
      expect(message).toContain('pas du json');
      expect(message).toContain('avertissement onnxruntime');
    } finally {
      await nettoyer(racine);
    }
  });

  it('borne l extrait quand la sortie est enorme', async () => {
    const script = scriptQui('process.stdout.write("X".repeat(5000));');
    const { racine, sortie } = await fauxProjet({ script });
    try {
      const { speak } = await chargerTts(racine);
      const erreur = await speak('bonjour', sortie).catch((cause: unknown) => cause);
      const message = String(erreur);
      expect(message).toContain('5000 octets');
      expect(message).toContain('[...]');
      expect(message.length).toBeLessThan(500);
    } finally {
      await nettoyer(racine);
    }
  });

  it('signale un JSON valide mais hors contrat, avec le champ fautif', async () => {
    const script = scriptQui(
      'process.stdout.write(JSON.stringify({ sampleRate: 22050, alignments: [' +
        '{ phoneme: "a", numSamples: -1 }] }));',
    );
    const { racine, sortie } = await fauxProjet({ script });
    try {
      const { speak } = await chargerTts(racine);
      const erreur = await speak('bonjour', sortie).catch((cause: unknown) => cause);
      const message = String(erreur);
      expect(message).toContain('sortie invalide');
      expect(message).toContain('alignments.0.numSamples');
    } finally {
      await nettoyer(racine);
    }
  });

  it('rejette une liste d alignements vide', async () => {
    const script = scriptQui(
      'process.stdout.write(JSON.stringify({ sampleRate: 22050, alignments: [] }));',
    );
    const { racine, sortie } = await fauxProjet({ script });
    try {
      const { speak } = await chargerTts(racine);
      await expect(speak('bonjour', sortie)).rejects.toThrow('sortie invalide');
    } finally {
      await nettoyer(racine);
    }
  });

  it('signale un interpreteur introuvable', async () => {
    const { racine, sortie } = await fauxProjet({ script: RAPPORTE_LE_TEXTE, python: false });
    try {
      const { speak } = await chargerTts(racine);
      await expect(speak('bonjour', sortie)).rejects.toThrow('introuvable ou non executable');
    } finally {
      await nettoyer(racine);
    }
  });
});

describe('ensureTooling : prerequis manquants', () => {
  it('signale un interpreteur .venv absent', async () => {
    const { racine } = await fauxProjet({ script: RAPPORTE_LE_TEXTE, python: false });
    try {
      const { ensureTooling } = await chargerTts(racine);
      await expect(ensureTooling()).rejects.toThrow("Python de l'environnement .venv introuvable");
    } finally {
      await nettoyer(racine);
    }
  });

  it('signale le script de synthese absent', async () => {
    const { racine } = await fauxProjet({});
    try {
      const { ensureTooling } = await chargerTts(racine);
      await expect(ensureTooling()).rejects.toThrow('Script de synthese Piper introuvable');
    } finally {
      await nettoyer(racine);
    }
  });

  it('signale le modele Piper absent', async () => {
    const { racine } = await fauxProjet({ script: RAPPORTE_LE_TEXTE });
    try {
      const { ensureTooling } = await chargerTts(racine);
      await expect(ensureTooling()).rejects.toThrow('Modele Piper introuvable');
    } finally {
      await nettoyer(racine);
    }
  });
});
