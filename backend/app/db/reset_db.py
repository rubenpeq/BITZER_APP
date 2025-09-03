#!/usr/bin/env python3
"""
db/reset_db.py

Drop & recreate selected tables (or all). Ensures proper dependency ordering
so tables that are referenced by foreign keys are created before children.

Examples:
  python -m db.reset_db --orders
  python -m db.reset_db --orders --users --yes
  python -m db.reset_db --all --yes
"""

import argparse
import sys
from typing import List

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import models and Base
from db.models import (
    Base,
    OrderDB,
    OperationDB,
    TaskDB,
    MachineDB,
    UserDB,
)

DATABASE_URL = "postgresql://bitzer:bitzer123@localhost/orders_db"

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


# Utility: present a confirm prompt
def confirm(prompt: str) -> bool:
    try:
        answer = input(f"{prompt} [y/N]: ").strip().lower()
    except (KeyboardInterrupt, EOFError):
        print()
        return False
    return answer in ("y", "yes")


# Table groups and safe group-level definitions (keeps previous friendly descriptions)
GROUPS = {
    "orders": {
        "tables": [OrderDB.__table__, OperationDB.__table__, TaskDB.__table__],
        "description": "OrderDB, OperationDB, TaskDB",
    },
    "machines": {
        "tables": [MachineDB.__table__, OperationDB.__table__],
        "description": "MachineDB (and OperationDB if needed)",
    },
    "users": {
        "tables": [UserDB.__table__, TaskDB.__table__],
        "description": "UserDB (and TaskDB if needed)",
    },
    # "all" handled specially
}

# GLOBAL create/drop order that respects FK dependencies:
# create: parents first, children later
GLOBAL_CREATE_ORDER = [
    UserDB.__table__,    # users (tasks -> users)
    MachineDB.__table__, # machines (operations -> machine)
    OrderDB.__table__,   # orders (operations -> order)
    OperationDB.__table__,# operations (tasks -> operation)
    TaskDB.__table__,    # tasks (depends on operation and possibly users)
]

# drop order is reverse: children first, parents last
GLOBAL_DROP_ORDER = list(reversed(GLOBAL_CREATE_ORDER))


def drop_tables(tables: List, engine):
    """Drop each Table object in order (checkfirst=True)."""
    for tbl in tables:
        try:
            tbl.drop(engine, checkfirst=True)
            print(f"Dropped table: {tbl.name}")
        except Exception as e:
            print(f"Warning: could not drop {tbl.name}: {e}")


def create_tables(tables: List, engine):
    """Create each Table object in order (checkfirst=True)."""
    for tbl in tables:
        try:
            tbl.create(engine, checkfirst=True)
            print(f"Created table: {tbl.name}")
        except Exception as e:
            print(f"Warning: could not create {tbl.name}: {e}")


def reset_selected(groups: List[str], skip_confirm: bool):
    """
    Reset the selected named groups (e.g. ["orders","machines"]).
    If "all" present, drop & recreate all tables in Base.metadata.
    """
    groups = [g.lower() for g in groups]
    if "all" in groups:
        if not skip_confirm:
            ok = confirm("⚠️  This will DROP and RECREATE ALL tables. Continue?")
            if not ok:
                print("❌ Cancelled.")
                return 0

        try:
            print("Dropping ALL tables...")
            Base.metadata.drop_all(engine)
            print("Recreating ALL tables...")
            Base.metadata.create_all(engine)
            print("✅ All tables recreated.")
            return 0
        except Exception as e:
            print(f"❌ Error while resetting all tables: {e}")
            return 2

    # Validate requested groups
    for g in groups:
        if g not in GROUPS:
            print(f"Unknown group '{g}'. Valid groups: {', '.join(GROUPS.keys())}, all")
            return 2

    # Build the union of table objects we need to act on
    requested_tables = []
    for g in groups:
        for t in GROUPS[g]["tables"]:
            if t not in requested_tables:
                requested_tables.append(t)

    # Use GLOBAL orders to produce dependency-safe sequences
    # For drops: take global drop order filtered by requested_tables
    drop_sequence = [t for t in GLOBAL_DROP_ORDER if t in requested_tables]
    # For create: take global create order filtered by requested_tables
    create_sequence = [t for t in GLOBAL_CREATE_ORDER if t in requested_tables]

    # Show summary and confirm
    drop_names = [t.name for t in drop_sequence]
    create_names = [t.name for t in create_sequence]
    print("The following tables will be DROPPED (in order):")
    for n in drop_names:
        print("  -", n)
    print("The following tables will be CREATED (in order):")
    for n in create_names:
        print("  -", n)

    if not skip_confirm:
        ok = confirm("Proceed with the above operations?")
        if not ok:
            print("❌ Cancelled.")
            return 0

    # Execute drop then create
    try:
        print("Dropping selected tables...")
        drop_tables(drop_sequence, engine)
        print("Recreating selected tables...")
        create_tables(create_sequence, engine)
        print("✅ Selected tables recreated.")
        return 0
    except Exception as e:
        print(f"❌ Error during reset: {e}")
        return 2


def main(argv=None):
    parser = argparse.ArgumentParser(description="Drop & recreate selected DB table groups.")
    parser.add_argument("--orders", action="store_true", help="Reset order-related tables: OrderDB, OperationDB, TaskDB")
    parser.add_argument("--machines", action="store_true", help="Reset machine-related tables: MachineDB (and OperationDB if needed)")
    parser.add_argument("--users", action="store_true", help="Reset user-related tables: UserDB (and TaskDB if needed)")
    parser.add_argument("--all", action="store_true", help="Reset ALL tables (equivalent to drop_all + create_all)")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args(argv)

    selected = []
    if args.all:
        selected = ["all"]
    else:
        if args.orders:
            selected.append("orders")
        if args.machines:
            selected.append("machines")
        if args.users:
            selected.append("users")

    if not selected:
        parser.error("No reset target specified. Use --orders, --machines, --users, or --all")

    rc = reset_selected(selected, skip_confirm=args.yes)
    sys.exit(rc)


if __name__ == "__main__":
    main()
