import os
import logging
import uuid
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("omnisentinel.database")

# ── In-Memory Fallback Database ──────────────────────────────────────────────
class MockCursor:
    def __init__(self, items):
        self.items = list(items)

    def sort(self, key, direction=1):
        reverse = direction == -1
        self.items.sort(key=lambda x: str(x.get(key, "")) if x.get(key) is not None else "", reverse=reverse)
        return self

    def limit(self, n):
        self.items = self.items[:n]
        return self

    async def to_list(self, length=None):
        if length is not None:
            return self.items[:length]
        return self.items

class MockCollection:
    def __init__(self, name):
        self.name = name
        self.docs = []

    async def find_one(self, filter_dict=None, sort=None):
        items = list(self.docs)
        if sort:
            key, direction = sort[0] if isinstance(sort, list) else (sort, 1)
            items.sort(key=lambda x: str(x.get(key, "")) if x.get(key) is not None else "", reverse=(direction == -1))
        for doc in items:
            match = True
            for k, v in (filter_dict or {}).items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                return dict(doc)
        return None

    def find(self, filter_dict=None, sort=None):
        matched = []
        for doc in self.docs:
            match = True
            for k, v in (filter_dict or {}).items():
                if doc.get(k) != v:
                    match = False
                    break
            if match:
                matched.append(dict(doc))
        cursor = MockCursor(matched)
        if sort:
            if isinstance(sort, list):
                key, direction = sort[0]
                cursor.sort(key, direction)
        return cursor

    async def insert_one(self, doc):
        d = dict(doc)
        if "_id" not in d:
            d["_id"] = uuid.uuid4().hex
        self.docs.append(d)
        class InsertResult:
            inserted_id = d["_id"]
        return InsertResult()

    async def update_one(self, filter_dict, update_dict, upsert: bool = False):
        doc = await self.find_one(filter_dict)
        if doc:
            for item in self.docs:
                if item.get("_id") == doc.get("_id"):
                    if "$set" in update_dict:
                        item.update(update_dict["$set"])
                    class UpdateResult:
                        modified_count = 1
                    return UpdateResult()
        elif upsert:
            new_item = dict(filter_dict or {})
            if "$set" in update_dict:
                new_item.update(update_dict["$set"])
            if "_id" not in new_item:
                new_item["_id"] = uuid.uuid4().hex
            self.docs.append(new_item)
            class UpdateResult:
                modified_count = 1
            return UpdateResult()
        class UpdateResult:
            modified_count = 0
        return UpdateResult()

    async def delete_one(self, filter_dict):
        for i, item in enumerate(self.docs):
            match = True
            for k, v in (filter_dict or {}).items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                self.docs.pop(i)
                class DeleteResult:
                    deleted_count = 1
                return DeleteResult()
        class DeleteResult:
            deleted_count = 0
        return DeleteResult()

    async def delete_many(self, filter_dict):
        orig_len = len(self.docs)
        self.docs = [d for d in self.docs if not all(d.get(k) == v for k, v in (filter_dict or {}).items())]
        class DeleteResult:
            deleted_count = orig_len - len(self.docs)
        return DeleteResult()

class MockDatabase:
    def __init__(self):
        self.collections = {}

    def __getitem__(self, name):
        if name not in self.collections:
            self.collections[name] = MockCollection(name)
        return self.collections[name]


# ── Database Singleton ───────────────────────────────────────────────────────
class Database:
    client: AsyncIOMotorClient = None
    db = None
    is_mock: bool = False

db_instance = Database()
mock_db = MockDatabase()


async def seed_demo_user(db):
    try:
        from ml.serving.auth import get_password_hash
        existing = await db["users"].find_one({"email": "analyst@soc.example"})
        if not existing:
            demo_user = {
                "_id": "demo-analyst-001",
                "name": "SOC Analyst",
                "email": "analyst@soc.example",
                "password_hash": get_password_hash("OmniSentinel2026!"),
                "team": "Threat Response SOC",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            await db["users"].insert_one(demo_user)
            logger.info("✓ Seeded demo user: analyst@soc.example / OmniSentinel2026!")
    except Exception as e:
        logger.warning(f"Failed to seed demo user: {e}")


async def connect_to_mongo():
    load_dotenv(override=True)
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DATABASE", "omnisentinel")

    try:
        kwargs = {"serverSelectionTimeoutMS": 3000}
        if "mongodb+srv://" in uri or "tls=true" in uri.lower():
            try:
                import certifi
                kwargs["tlsCAFile"] = certifi.where()
            except ImportError:
                pass

        client = AsyncIOMotorClient(uri, **kwargs)
        await client.server_info()
        db_instance.client = client
        db_instance.db = client[db_name]
        db_instance.is_mock = False
        safe_uri = uri.split("@")[-1] if "@" in uri else uri
        logger.info(f"✓ Connected to MongoDB at {safe_uri} (database: {db_name})")
        await seed_demo_user(db_instance.db)
        return db_instance.db
    except Exception as e:
        logger.warning(f"Could not connect to MongoDB ({e}). Activating in-memory mock database fallback.")
        db_instance.client = None
        db_instance.db = mock_db
        db_instance.is_mock = True
        await seed_demo_user(mock_db)
        return db_instance.db


async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logger.info("Closed MongoDB connection")


async def get_db():
    if db_instance.db is None or db_instance.is_mock:
        # Try to connect/reconnect to MongoDB if currently uninitialized or on mock
        try:
            db = await connect_to_mongo()
            return db
        except Exception:
            return mock_db
    return db_instance.db
