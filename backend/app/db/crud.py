from sqlalchemy.orm import Session
import models, schemas

# -------- ORDER --------
def create_order(db: Session, order: schemas.OrderCreate):
    db_order = models.OrderDB(**order.model_dump())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

def get_order(db: Session, order_number: int):
    return db.query(models.OrderDB).filter(models.OrderDB.order_number == order_number).first()

def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.OrderDB).offset(skip).limit(limit).all()


# -------- OPERATION --------
def create_operation(db: Session, operation: schemas.OperationCreate):
    db_operation = models.OperationDB(**operation.model_dump())
    db.add(db_operation)
    db.commit()
    db.refresh(db_operation)
    return db_operation

def get_operation(db: Session, operation_id: int):
    return db.query(models.OperationDB).filter(models.OperationDB.id == operation_id).first()

def get_operations(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.OperationDB).offset(skip).limit(limit).all()


# -------- TASK --------
def create_task(db: Session, task: schemas.TaskCreate):
    db_task = models.TaskDB(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def get_task(db: Session, task_id: int):
    return db.query(models.TaskDB).filter(models.TaskDB.id == task_id).first()

def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.TaskDB).offset(skip).limit(limit).all()
