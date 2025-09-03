# from backend/app, run `python -m db.import_machines`
import csv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Base, MachineDB, MachineType

DATABASE_URL = "postgresql://bitzer:bitzer123@localhost/orders_db"

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def str_to_machine_type(s: str):
    if not s:
        return None
    s = s.strip().upper()
    if s == "CNC":
        return MachineType.CNC
    if s == "CONVENTIONAL":
        return MachineType.CONVENTIONAL
    return None

def upsert_from_csv(csv_path):
    session = Session()
    try:
        with open(csv_path, newline='', encoding='utf-8') as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                loc = row.get("machine_location") or None
                descr = row.get("machine_description") or ""
                mid = row.get("machine_id_colN") or ""
                mtype_str = row.get("machine_type", "").strip()
                mtype_enum = str_to_machine_type(mtype_str)

                if not loc:
                    # skip entries with no location (or handle as you prefer)
                    continue

                existing = session.query(MachineDB).filter_by(machine_location=loc).one_or_none()
                if existing:
                    # update fields
                    existing.description = descr
                    existing.machine_id = mid
                    if mtype_enum is not None:
                        existing.machine_type = mtype_enum
                else:
                    new = MachineDB(
                        machine_location=loc,
                        description=descr,
                        machine_id=mid,
                        machine_type=mtype_enum if mtype_enum is not None else MachineType.CONVENTIONAL
                    )
                    session.add(new)
        session.commit()
        print("Import finished.")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    upsert_from_csv("db/machines_import.csv")
