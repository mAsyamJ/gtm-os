#!/usr/bin/env python3
"""Operator-only masked entry for dedicated Buffer service credentials.

Never accepts a key via arguments, environment, stdin pipes, or project files.
No network calls or global agent credential changes. Existing directories are
never replaced. Service installation remains a separate operator action.
"""
import argparse
import datetime
import getpass
import os
from pathlib import Path
import re
import sys
import warnings


def provision(brand, directory, expires, prompt=getpass.getpass):
    root = Path(__file__).resolve().parents[1]
    destination = Path(directory)
    if brand not in ('founder', 'retropick') or not destination.is_absolute():
        raise ValueError('Explicit tenant and absolute dedicated directory required')
    # Refuse symlink ancestors, project storage and existing credential sets.
    if any(p.is_symlink() for p in (destination, *destination.parents)):
        raise ValueError('Symlink credential paths are forbidden')
    if destination == root or root in destination.parents:
        raise ValueError('Credentials must be stored outside the checkout')
    if destination.exists() or not destination.parent.is_dir():
        raise ValueError('Use a new directory under an existing private operator-controlled parent')
    parent = destination.parent.stat()
    if parent.st_uid != os.geteuid() or parent.st_mode & 0o077:
        raise ValueError('Parent must be owned by this operator and mode 0700')
    if expires == 'unknown':
        expires = 'UNKNOWN_OWNER_ACCEPTED'
    else:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z', expires):
            raise ValueError('Supply actual expiration or explicit owner-accepted unknown')
        expiry = datetime.datetime.fromisoformat(expires.replace('Z', '+00:00'))
        now = datetime.datetime.now(datetime.timezone.utc)
        if not now < expiry <= now + datetime.timedelta(days=366):
            raise ValueError('Actual expiration must be in the next 366 days')
    with warnings.catch_warnings():
        warnings.simplefilter('error', getpass.GetPassWarning)
        value = prompt('Buffer API key (hidden): ')
    if not re.fullmatch(r'[A-Za-z0-9_.-]{16,4096}', value):
        raise ValueError('Invalid credential format; value withheld')
    destination.mkdir(mode=0o700)
    created = []
    try:
        for name, content in (('buffer-api-key', value), ('buffer-expiry', expires), ('buffer-tenant', brand)):
            fd = os.open(destination / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            created.append(destination / name)
            with os.fdopen(fd, 'w') as stream:
                stream.write(content + '\n')
                stream.flush()
                os.fsync(stream.fileno())
        fd = os.open(destination, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
    except BaseException:
        for path in created:
            path.unlink()
        destination.rmdir()
        raise
    finally:
        value = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--brand', required=True, choices=['founder', 'retropick'])
    parser.add_argument('--directory', required=True)
    parser.add_argument('--expires', required=True)
    args = parser.parse_args()
    if not sys.stdin.isatty() or not sys.stderr.isatty():
        parser.exit(4, 'BLOCKED: run from a private interactive terminal; pipes are forbidden.\n')
    try:
        provision(args.brand, args.directory, args.expires)
    except (ValueError, OSError, EOFError, KeyboardInterrupt, getpass.GetPassWarning):
        parser.exit(4, 'BLOCKED: provisioning failed; no credential value was logged.\n')
    print('Provisioned dedicated tenant credentials. No provider request or service installation performed.')


if __name__ == '__main__':
    main()
