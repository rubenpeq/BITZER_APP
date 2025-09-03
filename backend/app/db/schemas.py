from pydantic import BaseModel, model_validator, constr
import datetime
from typing import List, Optional, Annotated
import enum


# -------------------------------
# Enums
# -------------------------------
class ProcessType(str, enum.Enum):
    PREPARATION = "PREPARATION"
    QUALITY_CONTROL = "QUALITY_CONTROL"
    PROCESSING = "PROCESSING"


class MachineType(str, enum.Enum):
    CNC = "CNC"
    CONVENTIONAL = "CONVENTIONAL"


# -------------------------------
# User Schemas
# -------------------------------
class UserBase(BaseModel):
    name: str
    bitzer_id: Optional[int] = None
    active: bool = True
    is_admin: bool = False


class UserCreate(UserBase):
    password: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bitzer_id: Optional[int] = None
    password: Optional[str] = None
    active: Optional[bool] = None
    is_admin: Optional[bool] = None


class User(UserBase):
    id: int
    created_at: Optional[datetime.datetime] = None
    updated_at: Optional[datetime.datetime] = None

    model_config = {"from_attributes": True}


# -------------------------------
# Machine Schemas
# -------------------------------
class MachineBase(BaseModel):
    machine_location: str
    description: str
    machine_id: str
    machine_type: MachineType
    active: Optional[bool] = True


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    machine_location: Optional[str] = None
    description: Optional[str] = None
    machine_id: Optional[str] = None
    machine_type: Optional[MachineType] = None
    active: Optional[bool] = None


class Machine(MachineBase):
    id: int

    model_config = {"from_attributes": True}


# -------------------------------
# Task Schemas
# -------------------------------
class TaskBase(BaseModel):
    process_type: ProcessType
    start_at: Optional[datetime.datetime] = None
    end_at: Optional[datetime.datetime] = None
    num_benches: Optional[int] = None
    num_machines: Optional[int] = None
    good_pieces: Optional[int] = None
    bad_pieces: Optional[int] = None
    operator_user_id: Optional[int] = None
    operator_bitzer_id: Optional[int] = None
    notes: Annotated[Optional[str], constr(max_length=1000)] = None


class TaskCreate(TaskBase):
    @model_validator(mode="after")
    def check_dates(self) -> "TaskUpdate":
        if self.start_at and self.end_at and self.end_at < self.start_at:
            raise ValueError("Uma tarefa não pode acabar antes do seu início.")
        return self

class TaskUpdate(BaseModel):
    process_type: Optional[ProcessType] = None
    start_at: Optional[datetime.datetime] = None
    end_at: Optional[datetime.datetime] = None
    num_benches: Optional[int] = None
    num_machines: Optional[int] = None
    good_pieces: Optional[int] = None
    bad_pieces: Optional[int] = None
    operator_user_id: Optional[int] = None
    operator_bitzer_id: Optional[int] = None
    notes: Annotated[Optional[str], constr(max_length=1000)] = None

    @model_validator(mode="after")
    def check_dates(self) -> "TaskUpdate":
        if self.start_at and self.end_at and self.end_at < self.start_at:
            raise ValueError("Uma tarefa não pode acabar antes do seu início.")
        return self


class Task(TaskBase):
    id: int
    operation_id: int
    operator_user: Optional[User] = None

    model_config = {"from_attributes": True}


# -------------------------------
# Operation Schemas
# -------------------------------
class OperationBase(BaseModel):
    order_id: int
    operation_code: str
    machine_id: Optional[int] = None


class OperationCreate(OperationBase):
    pass


class OperationUpdate(BaseModel):
    order_id: Optional[int] = None
    operation_code: Optional[str] = None
    machine_id: Optional[int] = None


class Operation(OperationBase):
    id: int
    tasks: List[Task] = []
    machine: Optional[Machine] = None

    model_config = {"from_attributes": True}


# -------------------------------
# Order Schemas
# -------------------------------
class OrderBase(BaseModel):
    material_number: int
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    num_pieces: int


class OrderCreate(OrderBase):
    order_number: int


class OrderUpdate(BaseModel):
    material_number: Optional[int] = None
    start_date: Optional[datetime.date] = None
    end_date: Optional[datetime.date] = None
    num_pieces: Optional[int] = None
    order_number: Optional[int] = None


class Order(OrderBase):
    id: int
    order_number: int
    operations: List[Operation] = []

    model_config = {"from_attributes": True}


# -------------------------------
# Resolve Forward References
# -------------------------------
User.model_rebuild()
Task.model_rebuild()
Operation.model_rebuild()
Order.model_rebuild()
Machine.model_rebuild()
