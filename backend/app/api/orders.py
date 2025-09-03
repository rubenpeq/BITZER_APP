from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, timedelta

from db.database import SessionLocal
from db.models import OrderDB, OperationDB, TaskDB, MachineDB, UserDB
from db import schemas as s

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------
# Orders
# -----------------------
@router.get("/orders", response_model=List[s.Order], tags=["Orders"], summary="List all orders")
def list_orders(db: Session = Depends(get_db)):
    return db.query(OrderDB).all()

@router.get("/orders/recent", response_model=list[s.Order])
def get_recent_orders(db: Session = Depends(get_db)):
    """Get orders from the last 6 months."""
    six_months_ago = date.today() - timedelta(days=6 * 30)  # Approx 6 months
    orders = (
        db.query(OrderDB)
        .filter(OrderDB.start_date >= six_months_ago)
        .order_by(OrderDB.start_date.desc())
        .all()
    )
    return orders


@router.get("/orders/{order_number}", response_model=s.Order, tags=["Orders"], summary="Get order by order_number")
def get_order_by_number(order_number: int, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.get("/orders/id/{order_id}", response_model=s.Order, tags=["Orders"], summary="Get order by internal id")
def get_order_by_id(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.post("/orders", response_model=s.Order, tags=["Orders"], status_code=status.HTTP_201_CREATED, summary="Create order")
def create_order(order_in: s.OrderCreate, db: Session = Depends(get_db)):
    # ensure unique order_number
    exists = db.query(OrderDB).filter(OrderDB.order_number == order_in.order_number).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Order number {order_in.order_number} already exists.")
    new_order = OrderDB(**order_in.model_dump())
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order


@router.patch("/orders/{order_number}", response_model=s.Order, tags=["Orders"], summary="Partial update order by order_number")
def patch_order(order_number: int, order_in: s.OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    data = order_in.model_dump(exclude_unset=True)

    # if changing order_number, ensure uniqueness
    if "order_number" in data:
        new_on = data["order_number"]
        if new_on != order.order_number:
            conflict = db.query(OrderDB).filter(OrderDB.order_number == new_on).first()
            if conflict:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="New order_number already in use.")

    # validate dates if both present (or using existing)
    start = data.get("start_date", order.start_date)
    end = data.get("end_date", order.end_date)
    if start and end and start > end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date cannot be after end_date")

    for k, v in data.items():
        setattr(order, k, v)

    db.commit()
    db.refresh(order)
    return order


@router.delete("/orders/{order_number}", status_code=status.HTTP_204_NO_CONTENT, tags=["Orders"], summary="Delete order and its operations/tasks")
def delete_order(order_number: int, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # remove tasks -> operations -> order to avoid FK errors
    op_ids = [op.id for op in order.operations]
    if op_ids:
        db.query(TaskDB).filter(TaskDB.operation_id.in_(op_ids)).delete(synchronize_session=False)
        db.query(OperationDB).filter(OperationDB.id.in_(op_ids)).delete(synchronize_session=False)

    db.delete(order)
    db.commit()
    return None


# -----------------------
# Machines
# -----------------------
@router.get("/machines", response_model=List[s.Machine], tags=["Machines"], summary="List machines")
def list_machines(db: Session = Depends(get_db)):
    return db.query(MachineDB).all()


@router.get("/machines/{machine_id}", response_model=s.Machine, tags=["Machines"], summary="Get machine by id")
def get_machine(machine_id: int, db: Session = Depends(get_db)):
    m = db.query(MachineDB).filter(MachineDB.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found")
    return m


@router.post("/machines", response_model=s.Machine, status_code=status.HTTP_201_CREATED, tags=["Machines"], summary="Create machine")
def create_machine(machine_in: s.MachineCreate, db: Session = Depends(get_db)):
    # require unique machine_location
    exists = db.query(MachineDB).filter(MachineDB.machine_location == machine_in.machine_location).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="machine_location already exists")
    m = MachineDB(**machine_in.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.patch("/machines/{machine_id}", response_model=s.Machine, tags=["Machines"], summary="Partially update a machine")
def patch_machine(machine_id: int, machine_in: s.MachineUpdate, db: Session = Depends(get_db)):
    m = db.query(MachineDB).filter(MachineDB.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found")

    data = machine_in.model_dump(exclude_unset=True)
    if "machine_location" in data:
        new_loc = data["machine_location"]
        if new_loc != m.machine_location:
            conflict = db.query(MachineDB).filter(MachineDB.machine_location == new_loc).first()
            if conflict:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="machine_location already in use")

    for k, v in data.items():
        setattr(m, k, v)

    db.commit()
    db.refresh(m)
    return m


@router.delete("/machines/{machine_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Machines"], summary="Delete a machine (fails if used by operations)")
def delete_machine(machine_id: int, db: Session = Depends(get_db)):
    m = db.query(MachineDB).filter(MachineDB.id == machine_id).first()
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found")

    # prevent deleting machines that are referenced by operations
    used = db.query(OperationDB).filter(OperationDB.machine_id == m.id).first()
    if used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Machine is referenced by operations; remove/update them first")

    db.delete(m)
    db.commit()
    return None


# -----------------------
# Users
# -----------------------
@router.get("/users", response_model=List[s.User], tags=["Users"], summary="List users (optionally only active)")
def list_users(active: Optional[bool] = Query(None, description="If true, return only active users"), db: Session = Depends(get_db)):
    q = db.query(UserDB)
    if active is True:
        q = q.filter(UserDB.active == True)
    return q.all()


@router.get("/users/{user_id}", response_model=s.User, tags=["Users"], summary="Get user by id")
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return u


@router.post("/users", response_model=s.User, status_code=status.HTTP_201_CREATED, tags=["Users"], summary="Create user")
def create_user(user_in: s.UserCreate, db: Session = Depends(get_db)):
    data = user_in.model_dump(exclude_unset=True)
    # check unique bitzer_id when provided
    if data.get("bitzer_id") is not None:
        exists = db.query(UserDB).filter(UserDB.bitzer_id == data["bitzer_id"]).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="bitzer_id already in use")
    new_u = UserDB(**data)
    db.add(new_u)
    db.commit()
    db.refresh(new_u)
    return new_u


@router.patch("/users/{user_id}", response_model=s.User, tags=["Users"], summary="Partial update a user")
def patch_user(user_id: int, user_in: s.UserUpdate, db: Session = Depends(get_db)):
    u = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = user_in.model_dump(exclude_unset=True)
    if "bitzer_id" in data:
        new_bid = data["bitzer_id"]
        if new_bid is not None and new_bid != u.bitzer_id:
            conflict = db.query(UserDB).filter(UserDB.bitzer_id == new_bid).first()
            if conflict:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="bitzer_id already in use")

    for k, v in data.items():
        # handle password if later hashed (currently stored as password_hash)
        if k == "password":
            # caller currently sends plain-text password; we are not doing hashing right now
            # Future: hash here and write to password_hash
            setattr(u, "password_hash", v)
        else:
            setattr(u, k, v)

    db.commit()
    db.refresh(u)
    return u


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Users"], summary="Delete a user (fails if referenced by tasks)")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # prevent deleting users that are referenced by tasks
    used = db.query(TaskDB).filter(TaskDB.operator_user_id == u.id).first()
    if used:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is referenced by tasks; reassign or clear tasks first")

    db.delete(u)
    db.commit()
    return None


# -----------------------
# Operations
# -----------------------
@router.get("/orders/{order_number}/operations", response_model=List[s.Operation], tags=["Operations"], summary="List operations for an order_number")
def get_operations_for_order(order_number: int, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return db.query(OperationDB).filter(OperationDB.order_id == order.id).all()


@router.get("/operation/{operation_id}", response_model=s.Operation, tags=["Operations"], summary="Get operation by id")
def get_operation(operation_id: int, db: Session = Depends(get_db)):
    op = db.query(OperationDB).filter(OperationDB.id == operation_id).first()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")
    return op


@router.get("/operations/get_id", response_model=int, tags=["Operations"], summary="Get operation id by order_number and operation_code")
def get_operation_id(order_number: int, operation_code: str, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.order_number == order_number).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    op = db.query(OperationDB).filter(OperationDB.order_id == order.id, OperationDB.operation_code == operation_code).first()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")
    return op.id


@router.post("/operations", response_model=s.Operation, status_code=status.HTTP_201_CREATED, tags=["Operations"], summary="Create operation")
def create_operation(operation_in: s.OperationCreate, db: Session = Depends(get_db)):
    data = operation_in.model_dump(exclude_unset=True)

    # allow either order_id or order_number for compatibility
    order_obj = None
    if "order_id" in data and data["order_id"] is not None:
        order_obj = db.query(OrderDB).filter(OrderDB.id == data["order_id"]).first()
    elif "order_number" in data:  # if client sends order_number
        order_obj = db.query(OrderDB).filter(OrderDB.order_number == data["order_number"]).first()

    if not order_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Referenced order not found")

    # check duplicate operation_code per order
    op_code = data.get("operation_code")
    if op_code is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="operation_code is required")
    conflict = db.query(OperationDB).filter(OperationDB.order_id == order_obj.id, OperationDB.operation_code == op_code).first()
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Operation code already exists for this order")

    # validate machine if provided
    machine_id = data.get("machine_id")
    if machine_id is not None:
        m = db.query(MachineDB).filter(MachineDB.id == machine_id).first()
        if not m:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Referenced machine not found")

    new_op = OperationDB(
        order_id=order_obj.id,
        operation_code=str(op_code),
        machine_id=machine_id,
    )
    db.add(new_op)
    db.commit()
    db.refresh(new_op)
    return new_op


@router.patch("/operations/{operation_id}", response_model=s.Operation, tags=["Operations"], summary="Partial update operation")
def patch_operation(operation_id: int, op_in: s.OperationUpdate, db: Session = Depends(get_db)):
    op = db.query(OperationDB).filter(OperationDB.id == operation_id).first()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    data = op_in.model_dump(exclude_unset=True)

    # if updating operation_code, ensure uniqueness for the same order
    if "operation_code" in data:
        new_code = data["operation_code"]
        conflict = db.query(OperationDB).filter(OperationDB.order_id == op.order_id, OperationDB.operation_code == new_code, OperationDB.id != op.id).first()
        if conflict:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Another operation with this code exists for the same order")

    # if changing machine_id, validate it exists (allow null to clear)
    if "machine_id" in data:
        mid = data["machine_id"]
        if mid is not None:
            m = db.query(MachineDB).filter(MachineDB.id == mid).first()
            if not m:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Referenced machine not found")

    for k, v in data.items():
        setattr(op, k, v)

    db.commit()
    db.refresh(op)
    return op


@router.delete("/operations/{operation_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Operations"], summary="Delete operation and its tasks")
def delete_operation(operation_id: int, db: Session = Depends(get_db)):
    op = db.query(OperationDB).filter(OperationDB.id == operation_id).first()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    # delete tasks first
    db.query(TaskDB).filter(TaskDB.operation_id == op.id).delete(synchronize_session=False)
    db.delete(op)
    db.commit()
    return None


@router.get(
    "/operations/{operation_id}/pieces",
    tags=["Operations"],
    summary="Return sum of good + bad pieces for an operation",
)
def get_total_pieces(operation_id: int, db: Session = Depends(get_db)):
    # ensure operation exists
    op = db.query(OperationDB).filter(OperationDB.id == operation_id).first()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    # Use SQLAlchemy func and coalesce to safely sum nullable columns
    # Returns a single row with two fields (good_sum, bad_sum)
    row = (
        db.query(
            func.coalesce(func.sum(TaskDB.good_pieces), 0).label("good_sum"),
            func.coalesce(func.sum(TaskDB.bad_pieces), 0).label("bad_sum"),
        )
        .filter(TaskDB.operation_id == operation_id)
        .one()
    )

    good = int(row.good_sum or 0)
    bad = int(row.bad_sum or 0)
    total = good + bad

    return {"good_pieces": good, "bad_pieces": bad, "total_pieces": total}


# -----------------------
# Tasks
# -----------------------
@router.get("/task/{task_id}", response_model=s.Task, tags=["Tasks"], summary="Get task by id")
def get_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return t


@router.get("/operations/{operation_id}/tasks", response_model=List[s.Task], tags=["Tasks"], summary="List tasks for an operation")
def get_tasks_for_operation(operation_id: int, db: Session = Depends(get_db)):
    return db.query(TaskDB).filter(TaskDB.operation_id == operation_id).all()


@router.post("/operations/{operation_id}/tasks", response_model=s.Task, status_code=status.HTTP_201_CREATED, tags=["Tasks"], summary="Create task for operation")
def create_task(operation_id: int, task_in: s.TaskCreate, db: Session = Depends(get_db)):
    op = db.query(OperationDB).filter(OperationDB.id == operation_id).first()
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operation not found")

    data = task_in.model_dump(exclude_unset=True)

    # If operator_user_id provided, validate user exists and snapshot bitzer_id if not provided
    if "operator_user_id" in data and data["operator_user_id"] is not None:
        user = db.query(UserDB).filter(UserDB.id == data["operator_user_id"]).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Referenced operator user not found")
        # snapshot bitzer_id if not provided
        if "operator_bitzer_id" not in data or data.get("operator_bitzer_id") is None:
            data["operator_bitzer_id"] = user.bitzer_id

    # create TaskDB with operation_id forced
    t = TaskDB(**data, operation_id=operation_id)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.patch("/tasks/{task_id}", response_model=s.Task, tags=["Tasks"], summary="Update task (PATCH)")
def patch_task(task_id: int, task_in: s.TaskUpdate, db: Session = Depends(get_db)):
    t = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    data = task_in.model_dump(exclude_unset=True)

    # If operator_user_id set and operator_bitzer_id not provided, snapshot user's bitzer_id
    if "operator_user_id" in data:
        if data["operator_user_id"] is None:
            # clearing operator
            data["operator_bitzer_id"] = None
        else:
            user = db.query(UserDB).filter(UserDB.id == data["operator_user_id"]).first()
            if not user:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Referenced operator user not found")
            if "operator_bitzer_id" not in data or data.get("operator_bitzer_id") is None:
                data["operator_bitzer_id"] = user.bitzer_id

    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return t



@router.delete("/task/{task_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Tasks"], summary="Delete task")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(TaskDB).filter(TaskDB.id == task_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(t)
    db.commit()
    return None


@router.get("/tasks", response_model=List[s.Task], tags=["Tasks"], summary="List all tasks")
def list_tasks(db: Session = Depends(get_db)):
    return db.query(TaskDB).all()
