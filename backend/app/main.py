from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import Base, engine, get_session
from .models import Item
from .schemas import ItemCreate, ItemRead


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea las tablas al arrancar (para hackathon; en prod usar migraciones)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Hackaton API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "Hackaton API funcionando"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/items", response_model=list[ItemRead])
async def list_items(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Item))
    return result.scalars().all()


@app.post("/api/items", response_model=ItemRead, status_code=201)
async def create_item(
    payload: ItemCreate, session: AsyncSession = Depends(get_session)
):
    item = Item(**payload.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@app.get("/api/items/{item_id}", response_model=ItemRead)
async def get_item(
    item_id: int, session: AsyncSession = Depends(get_session)
):
    item = await session.get(Item, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return item
