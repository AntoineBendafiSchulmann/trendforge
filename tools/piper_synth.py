"""Synthetise un WAV avec Piper et rapporte l'alignement phoneme/echantillons.

Le texte arrive sur stdin en UTF-8, le rapport JSON repart sur stdout.
Toute trace de diagnostic va sur stderr.
"""

import argparse
import json
import sys
import wave

from piper import PiperVoice


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    text = sys.stdin.buffer.read().decode("utf-8")
    if not text.strip():
        print("texte vide sur stdin", file=sys.stderr)
        return 2

    voice = PiperVoice.load(args.model, include_alignments=True)
    with wave.open(args.output, "wb") as wav_file:
        alignments = voice.synthesize_wav(text, wav_file, include_alignments=True)

    if not alignments:
        print(
            "alignement indisponible : installer piper-tts[alignment] (paquet onnx)",
            file=sys.stderr,
        )
        return 3

    payload = {
        "sampleRate": voice.config.sample_rate,
        "alignments": [
            {"phoneme": item.phoneme, "numSamples": int(item.num_samples)}
            for item in alignments
        ],
    }
    sys.stdout.buffer.write(json.dumps(payload).encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
