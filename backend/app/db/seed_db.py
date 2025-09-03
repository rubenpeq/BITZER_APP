#!/usr/bin/env python3
"""
db/seed_data.py

Flexible seeding script (no CSVs). Generates realistic random machines, users, orders+operations+tasks.

Usage examples:
  python -m db.seed_data --machines 40 --users 10 --orders 20
  python -m db.seed_data --machines 10
  python -m db.seed_data --orders 5
"""

import argparse
import random
from datetime import datetime, date, time, timedelta, timezone
from typing import List, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import your models (adjust import path if different)
from db.models import (
    Base,
    OrderDB,
    OperationDB,
    TaskDB,
    MachineDB,
    UserDB,
    ProcessType,
    MachineType,
)

DATABASE_URL = "postgresql://bitzer:bitzer123@localhost/orders_db"

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


# -----------------------
# Data pools
# -----------------------
FIRST_NAMES = [
    "João", "Miguel", "Sofia", "Ana", "Tiago", "Rui", "Pedro", "Mariana", "Carlos", "Duarte",
    "Inês", "Rita", "Marta", "Helena", "José", "Bruno", "Beatriz", "André", "Filipa", "Luís"
]

LAST_NAMES = [
    "Silva", "Santos", "Ferreira", "Pereira", "Rodrigues", "Oliveira", "Costa", "Gomes",
    "Martins", "Rocha", "Lopes", "Carvalho", "Almeida", "Nunes", "Ribeiro", "Pinto"
]

# Operation codes requested examples and some extras
OPERATION_CODES = ["0040", "0110", "0010", "0210", "0310", "0410"]

# Machine description samples inspired by your CSV (Portuguese)
MACHINE_DESCRIPTIONS_CNC = [
    "Serra de Corte", "Torno CNC DAEWOO PUMA", "Furadeira Coluna BLUTHARDT",
    "Furadeira FLOTT", "Fresa CNC HELLER PFH", "Centro de Processamento MAKINO",
    "Centro DAEWOO HM-500", "Fresa Vertical HELLER", "Rectificadora GÖCKEL G80",
    "Brunimento NAGEL VS", "Prensa Hidráulica BLITZ", "Centro Processamento Vertical",
    "Soldadura Robotizada", "Fresa FRITZ WERNER"
]

MACHINE_DESCRIPTIONS_CONV = [
    "Operação de Mão-de-obra", "Máquina de Marcação Markator", "Braço de Roscar Elétrico",
    "Soldar à Mão", "Máquina de Lavagem MTM III", "Máquina de Decapar", "Rebarbar Peças",
    "Sala de Polimento", "Instalação Pintura", "Enchimento com Óleo", "Linha de Montagem",
    "Embalagem Manual", "Montagem Grupos Condensação", "Pintura a Pó"
]

# distribution: more CNC in pool
MACHINE_TYPE_WEIGHT = [MachineType.CNC] * 70 + [MachineType.CONVENTIONAL] * 30


# -----------------------
# Helper generators
# -----------------------
def gen_machine_location(existing_locs: set) -> str:
    # Try integer-like 3-5 digit codes (e.g., 11100, 12705) or alphanumeric tokens occasionally
    for _ in range(100):
        if random.random() < 0.9:
            loc = str(random.randint(1000, 99999))  # covers 4-5 digit style
        else:
            loc = random.choice(["LINHA-AB", "PM2000", "QM2000", "CAP-MGC"])
        if loc not in existing_locs:
            return loc
    # fallback: append suffix
    return f"LOC-{random.randint(10000,99999)}"


def gen_machine_id_colN(existing_ids: set) -> str:
    # numeric machine id like 10000405 etc
    for _ in range(100):
        mid = str(random.randint(10000000, 99999999))
        if mid not in existing_ids:
            return mid
    return str(random.randint(10000000, 99999999))


def gen_machine_description(mtype: MachineType) -> str:
    if mtype == MachineType.CNC:
        return random.choice(MACHINE_DESCRIPTIONS_CNC)
    return random.choice(MACHINE_DESCRIPTIONS_CONV)


def gen_user_name(existing_names: set) -> str:
    for _ in range(50):
        name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"
        if name not in existing_names:
            return name
    return f"User {random.randint(1000,9999)}"


# -----------------------
# Seeding functions
# -----------------------
def seed_machines(session, count: int):
    print(f"Seeding {count} machines...")
    existing = {m.machine_location: m for m in session.query(MachineDB).all()}
    existing_ids = {m.machine_id for m in existing.values() if m.machine_id}
    existing_locs = set(existing.keys())

    inserted = 0
    updated = 0

    for _ in range(count):
        mtype = random.choice(MACHINE_TYPE_WEIGHT)
        loc = gen_machine_location(existing_locs)
        mid = gen_machine_id_colN(existing_ids)
        desc = gen_machine_description(mtype)

        # If location already exists, update description/id/type
        if loc in existing:
            m = existing[loc]
            m.description = desc
            m.machine_id = mid
            m.machine_type = mtype
            m.active = True
            updated += 1
        else:
            m = MachineDB(
                machine_location=loc,
                description=desc,
                machine_id=mid,
                machine_type=mtype,
                active=True,
            )
            session.add(m)
            existing[loc] = m
            existing_locs.add(loc)
            existing_ids.add(mid)
            inserted += 1

    session.commit()
    print(f"Machines: inserted {inserted}, updated {updated}.")


def seed_users(session, count: int):
    print(f"Seeding {count} users...")
    existing_bitzer = {u.bitzer_id for u in session.query(UserDB).all() if u.bitzer_id is not None}
    existing_names = {u.name for u in session.query(UserDB).all()}
    inserted = 0

    for _ in range(count):
        name = gen_user_name(existing_names)
        existing_names.add(name)

        # bitzer id in a plausible range; ensure uniqueness
        bitzer = random.randint(1000, 9999)
        while bitzer in existing_bitzer:
            bitzer = random.randint(1000, 9999)
        existing_bitzer.add(bitzer)

        u = UserDB(
            name=name,
            bitzer_id=bitzer,
            password_hash=None,  # no password/auth for now
            active=True,
            is_admin=False,
        )
        session.add(u)
        inserted += 1

    session.commit()
    print(f"Inserted {inserted} users.")


def seed_orders_operations_tasks(session, count: int):
    print(f"Seeding {count} orders (+ operations + tasks)...")
    machines = session.query(MachineDB).all()
    users = session.query(UserDB).all()
    user_count = len(users)

    inserted_orders = 0
    inserted_ops = 0
    inserted_tasks = 0

    for _ in range(count):
        order_number = random.randint(100000, 199999)
        material_number = random.randint(100000, 999999)
        start = date.today() - timedelta(days=random.randint(0, 30))
        end = start + timedelta(days=random.randint(3, 14))
        num_pieces = random.randint(5, 200)

        order = OrderDB(
            order_number=order_number,
            material_number=material_number,
            start_date=start,
            end_date=end,
            num_pieces=num_pieces,
        )
        session.add(order)
        session.flush()  # get order.id
        inserted_orders += 1

        # 1-4 operations per order
        for _op in range(random.randint(1, 4)):
            op_code = random.choice(OPERATION_CODES)
            chosen_machine = random.choice(machines) if machines else None
            op = OperationDB(
                order_id=order.id,
                operation_code=op_code,
                machine_id=chosen_machine.id if chosen_machine else None,
            )
            session.add(op)
            session.flush()
            inserted_ops += 1

            # 1-5 tasks per operation
            for _t in range(random.randint(1, 5)):
                # pick a day between start and end
                delta_days = max(0, (end - start).days)
                chosen_day = start + timedelta(days=random.randint(0, delta_days))
                # timezone-aware: use UTC times for simplicity
                start_dt = datetime.combine(chosen_day, time(hour=random.randint(6, 17), minute=random.randint(0, 59)), tzinfo=timezone.utc)
                duration_min = random.randint(15, 180)
                end_dt = start_dt + timedelta(minutes=duration_min)

                # choose operator: 80% chance to reference a real user
                if user_count > 0 and random.random() < 0.8:
                    operator_user = random.choice(users)
                    operator_user_id = operator_user.id
                    operator_bitzer_id = operator_user.bitzer_id
                else:
                    operator_user_id = None
                    operator_bitzer_id = None

                # create task without 'operator' string field (TaskDB doesn't have operator column)
                task = TaskDB(
                    operation_id=op.id,
                    process_type=random.choice(list(ProcessType)),
                    operator_user_id=operator_user_id,
                    operator_bitzer_id=operator_bitzer_id,
                    start_at=start_dt,
                    end_at=end_dt,
                    num_benches=random.choice([None, 1, 2, 4]),
                    num_machines=random.choice([None, 1]),
                    good_pieces=random.randint(0, 50),
                    bad_pieces=random.randint(0, 10),
                )
                session.add(task)
                inserted_tasks += 1

        # commit per order to keep transactions reasonably sized
        session.commit()

    print(f"Inserted {inserted_orders} orders, {inserted_ops} operations, {inserted_tasks} tasks.")


# -----------------------
# CLI Entrypoint
# -----------------------
def main():
    parser = argparse.ArgumentParser(description="Seed database selectively (machines/users/orders).")
    parser.add_argument("--machines", type=int, metavar="N", help="Create N random machines (fields similar to your CSV).")
    parser.add_argument("--users", type=int, metavar="N", help="Create N users.")
    parser.add_argument("--orders", type=int, metavar="N", help="Create N orders (plus operations & tasks).")

    args = parser.parse_args()

    if not (args.machines or args.users or args.orders):
        parser.error("No seeding action specified. Provide --machines N, --users N and/or --orders N")

    Base.metadata.create_all(engine)
    session = Session()
    try:
        if args.machines:
            seed_machines(session, args.machines)
        if args.users:
            seed_users(session, args.users)
        if args.orders:
            seed_orders_operations_tasks(session, args.orders)
    finally:
        session.close()


if __name__ == "__main__":
    main()
