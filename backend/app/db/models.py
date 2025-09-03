from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    ForeignKey,
    Enum,
    Boolean,
    Text,
    func,
)
from sqlalchemy.orm import relationship
import enum
from .database import Base


### Enums for process type and machine type ###
class ProcessType(enum.Enum):
    PREPARATION = "PREPARATION"
    QUALITY_CONTROL = "QUALITY_CONTROL"
    PROCESSING = "PROCESSING"


class MachineType(enum.Enum):
    CNC = "CNC"
    CONVENTIONAL = "CONVENTIONAL"


### Database Tables ###
class OrderDB(Base):
    __tablename__ = "ordersdb"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_number = Column(Integer, unique=True, nullable=False)
    material_number = Column(Integer, nullable=False)
    
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    num_pieces = Column(Integer, nullable=False)

    # relationships
    operations = relationship("OperationDB", back_populates="order")


class MachineDB(Base):
    __tablename__ = "machinesdb"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_location = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=False)
    machine_id = Column(String, nullable=False)
    machine_type = Column(Enum(MachineType), nullable=False)

    active = Column(Boolean, nullable=False, default=True)
    
    # relationships
    operations = relationship("OperationDB", back_populates="machine")
    
class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bitzer_id = Column(Integer, unique=True, nullable=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    is_admin = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # relationships
    tasks = relationship("TaskDB", back_populates="operator_user")

class OperationDB(Base):
    __tablename__ = "operationsdb"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("ordersdb.id"), nullable=False)
    operation_code = Column(String, nullable=False)
    machine_id = Column(Integer, ForeignKey("machinesdb.id"), nullable=True)

    # relationships
    order = relationship("OrderDB", back_populates="operations")
    machine = relationship("MachineDB", back_populates="operations")
    tasks = relationship("TaskDB", back_populates="operation")


class TaskDB(Base):
    __tablename__ = "tasksdb"

    id = Column(Integer, primary_key=True, autoincrement=True)
    operation_id = Column(Integer, ForeignKey("operationsdb.id"), nullable=False)
    process_type = Column(Enum(ProcessType), nullable=False)

    operator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    operator_bitzer_id = Column(Integer, nullable=True)     # snapshot of the bitzer_id at creation

    # timezone-aware instants for tasks
    start_at = Column(DateTime(timezone=True), nullable=True)
    end_at = Column(DateTime(timezone=True), nullable=True)

    num_benches = Column(Integer, nullable=True)
    num_machines = Column(Integer, nullable=True)

    good_pieces = Column(Integer, nullable=True)
    bad_pieces = Column(Integer, nullable=True)
    
    notes = Column(Text, nullable=True)

    # relationships
    operator_user = relationship("UserDB", back_populates="tasks")
    operation = relationship("OperationDB", back_populates="tasks")
