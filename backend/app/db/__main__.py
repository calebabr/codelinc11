"""One command to create the database and load the seeds.

    cd backend
    python -m app.db            # create (if missing) and seed
    python -m app.db --reset    # delete and rebuild from scratch
"""

from __future__ import annotations

import sys

from .core import db_path, migrate, reset


def main(argv: list[str]) -> int:
    path = db_path()
    if "--reset" in argv or not path.exists():
        reset(path)
        print(f"Created {path} and loaded the demo household.")
    else:
        applied = migrate(path)
        print(f"{path} exists. Applied migrations: {applied or 'none'}. Use --reset to reseed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
