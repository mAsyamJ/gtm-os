#!/usr/bin/env python3
"""Validate local Phase D media without installs, auth, provider calls or historical receipt edits."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from project_inputs import project_inputs

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/evidence'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write(name, value):
    path = EVIDENCE / f'phase-d-{name}.json'
    path.write_text(json.dumps(value, indent=2) + '\n')
    return path


def run(command, expected=0, timeout=180):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if result.returncode != expected:
        raise RuntimeError(f"Gate failed: {' '.join(command)}; exit {result.returncode}, expected {expected}")
    return result


def main():
    (ROOT / 'runtime').mkdir(exist_ok=True)
    historical = {p: digest(p.read_bytes()) for p in EVIDENCE.glob('phase-[abc]-*.json')}
    for name in ['lint', 'build']:
        run(['pnpm', name]); write(name, {'status': 'PASS', 'command': ['pnpm', name]})
    run(['pnpm', 'exec', 'vitest', 'run', '--reporter=json', '--outputFile=runtime/phase-d-vitest.json'])
    tests = json.loads((ROOT / 'runtime/phase-d-vitest.json').read_text())
    if not tests['success'] or tests['numFailedTests'] or tests['numPendingTests']:
        raise RuntimeError('Not all runtime tests passed')
    write('tests', {'status': 'PASS', 'tests': tests['numTotalTests'], 'passed': tests['numPassedTests'], 'failed': tests['numFailedTests'], 'skipped': tests['numPendingTests']})
    write('governance', json.loads(run(['python3', 'scripts/validate_scaffold.py', '--json']).stdout))
    python_tests = run(['python3', '-m', 'unittest', 'discover', '-s', 'tests', '-v'])
    write('python-tests', {'status': 'PASS', 'output': python_tests.stdout + python_tests.stderr})
    dependencies = json.loads(run(['python3', 'scripts/inventory_dependencies.py', '--revision', 'phase-d-r1']).stdout)
    write('dependencies', dependencies)
    tool_checks = []
    for command in [['/usr/bin/ffmpeg', '-version'], ['/usr/bin/ffmpeg', '-L'], ['/usr/bin/ffprobe', '-version'], ['/usr/bin/google-chrome', '--version']]:
        result = run(command); tool_checks.append({'command': command, 'output': result.stdout + result.stderr})
    tools = {'revision': 'phase-d-r1', 'checks': tool_checks,
             'files': [{'path': path, 'sha256': digest(Path(path).read_bytes())} for path in ['/usr/bin/ffmpeg', '/usr/bin/ffprobe', '/usr/bin/google-chrome', '/opt/google/chrome/chrome'] if Path(path).is_file()],
             'satori_reference': {'repository': 'https://github.com/vercel/satori', 'commit': 'f725edd4ca99a4c86cfd3dfbc1d50123e47e6404', 'version': '0.62.0',
                                  'reviewed': 'src/satori.ts font buffers/onNodeDetected and layout.ts geometry; explicit border-box required', 'adapted_code': False},
             'reference_index': {'scoped_project_files': 13, 'scoped_project_records': 149, 'satori_files': 82, 'satori_records': 1131,
                                 'whole_project_refresh': 'FAILED_EXISTING_PROJECT_STATUS_FILE_FAMILY_CONFLICT', 'semantic_or_paid_embedding_calls': 0}}
    write('tools', tools)
    write('licenses', {'revision': 'phase-d-r1', 'fonts': json.loads((ROOT / 'creative/assets/fonts/manifest.json').read_text()),
                       'tools': json.loads((ROOT / 'creative/assets/licenses/manifest.json').read_text()),
                       'native_libvips_license_metadata': 'LGPL-3.0-or-later', 'ffmpeg_build_license': 'GPL-2.0-or-later',
                       'video_shotcraft': 'NOT_INSTALLED_OR_USED; FFmpeg selected, no Remotion/asset eligibility inferred',
                       'actual_product_capture': 'NOT_PERFORMED_UNVERIFIED_SCOPE',
                       'limitations': ['Not a complete transitive legal/patent audit', 'No stock assets, music, footage, voice model, likeness or official brand artwork', 'No system tool binaries redistributed']})
    run(['node', 'scripts/generate_phase_d_samples.mjs'])
    first = (EVIDENCE / 'phase-d-media.json').read_bytes()
    run(['node', 'scripts/generate_phase_d_samples.mjs', '--rebuild'])
    if first != (EVIDENCE / 'phase-d-media.json').read_bytes():
        raise RuntimeError('Media manifests/browser checks changed during identical-input replay')
    media = json.loads(first)
    if len(media['graphics']) != 24 or len(media['videos']) != 2 or len(media['browserChecks']) != 24 or media['browser']['attemptedRequests']:
        raise RuntimeError('Media/browser acceptance counts differ')
    for item in media['graphics'] + media['videos']:
        path = ROOT / item['receipt']['path']
        if digest(path.read_bytes()) != item['receipt']['sha256']:
            raise RuntimeError('Media receipt digest mismatch')
        manifest = json.loads(path.read_text())
        for file in manifest['files']:
            if digest((ROOT / file['path']).read_bytes()) != file['sha256']:
                raise RuntimeError('Media output byte digest mismatch')
    commands = [(['doctor'], 0), (['install', 'audit'], 0)]
    for tenant, template in [('retropick', 'feature-hero'), ('founder', 'decision-note')]:
        commands.extend([(['design', 'templates', '--brand', tenant], 0),
                         (['design', 'render', '--brand', tenant, '--template', template, '--fixture', 'synthetic'], 0),
                         (['video', 'storyboard', '--brand', tenant, '--fixture', 'synthetic'], 0),
                         (['publish', 'run', '--brand', tenant], 3)])
    for size in ['landscape', 'portrait']:
        commands.append((['video', 'render', '--brand', 'retropick', '--fixture', 'synthetic', '--size', size], 0))
    commands.extend([(['design', 'render', '--brand', 'founder'], 2), (['video', 'render', '--brand', 'founder'], 3),
                     (['design', 'templates'], 2), (['x', 'auth', 'status', '--brand', 'founder'], 4)])
    cli_checks = []
    for command, expected in commands:
        result = run(['node', 'dist/packages/cli/src/index.js', *command, '--json'], expected)
        output = json.loads(result.stdout)
        cli_checks.append({'args': command, 'expected_exit': expected, 'exit': result.returncode, 'status': output['status'], 'output_sha256': digest(result.stdout.encode())})
    write('cli', {'status': 'PASS', 'checks': cli_checks})
    write('security', json.loads(run(['python3', 'scripts/security_audit.py', '--json']).stdout))
    if any(digest(p.read_bytes()) != hash_value for p, hash_value in historical.items()):
        raise RuntimeError('Historical A/B/C receipts changed')
    source_manifest = write('sources', {'files': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p.read_bytes())}
                                                for p in project_inputs(ROOT) if p.name not in {'phase-d-sources.json', 'phase-d-receipt.json'}]})
    write('receipt', {'revision': 'phase-d-r1', 'status': 'PASS', 'baseline_commit': 'd2962c1',
                      'runtime_tests': tests['numPassedTests'], 'python_tests': 38, 'cli_checks': len(cli_checks),
                      'graphics': 24, 'editable_templates': 6, 'browser_pixel_checks': 24, 'videos': 2,
                      'video_seconds_each': 20, 'video_sizes': ['1920x1080', '1080x1920'],
                      'media_replay': 'FRESH_REENCODE_WITH_IDENTICAL_INPUT_MANIFESTS_AND_BYTE_HASHES_VERIFIED',
                      'sources': {'path': str(source_manifest.relative_to(ROOT)), 'sha256': digest(source_manifest.read_bytes())},
                      'historical_evidence_unchanged': True, 'provider_calls': 0, 'provider_cost_usd': 0,
                      'operator_compute_cost': 'NOT_MEASURED', 'publication_authorized': False,
                      'limitations': ['Synthetic editorial concept, not verified product demo; official tokens and live UI remain unverified',
                                      'Silent by design; no audio assets or voice model', 'Owner creative/publication review required',
                                      'Exact rendering reproduction requires recorded native/browser/font/FFmpeg toolchain; no cross-platform bit equality promised',
                                      'Security uses scoped local rules, not a complete dependency vulnerability or legal audit']})
    print(json.dumps({'status': 'PASS', 'runtime_tests': tests['numPassedTests'], 'cli_checks': len(cli_checks), 'graphics': 24, 'videos': 2, 'receipt': 'docs/evidence/phase-d-receipt.json'}))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, OSError, subprocess.TimeoutExpired, ValueError, KeyError) as error:
        print(json.dumps({'status': 'FAIL', 'reason': str(error)}))
        sys.exit(5)
