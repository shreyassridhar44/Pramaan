"""Append-only, hash-chained audit log (ARCHITECTURE.md Section 5).

hash = SHA-256(prev_hash || canonical_json(at, actor_id, action, entity_type, entity_id, data))
Appends take a transaction-scoped advisory lock so the chain stays linear under concurrency.
"""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import orjson
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEntry

GENESIS = "0" * 64
_LOCK_KEY = 7_265_265


def canonical(
    at: datetime,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None,
    data: dict[str, Any],
) -> bytes:
    return orjson.dumps(
        {
            "at": at.astimezone(UTC).isoformat(timespec="microseconds"),
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "data": data,
        },
        option=orjson.OPT_SORT_KEYS,
        default=str,
    )


def chain_hash(prev_hash: str, payload: bytes) -> str:
    return hashlib.sha256(prev_hash.encode() + payload).hexdigest()


async def append(
    session: AsyncSession,
    *,
    actor_id: int | None,
    actor_label: str,
    action: str,
    entity_type: str,
    entity_id: int | None,
    data: dict[str, Any] | None = None,
    note: str | None = None,
    at: datetime | None = None,
) -> AuditEntry:
    """Adds an entry in the caller's transaction. The caller commits."""
    await session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_KEY})
    prev = await session.scalar(select(AuditEntry.hash).order_by(AuditEntry.id.desc()).limit(1))
    when = at or datetime.now(UTC)
    payload = data or {}
    prev_hash = prev or GENESIS
    entry = AuditEntry(
        at=when,
        actor_id=actor_id,
        actor_label=actor_label,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        data=payload,
        prev_hash=prev_hash,
        hash=chain_hash(
            prev_hash, canonical(when, actor_id, action, entity_type, entity_id, payload)
        ),
        note=note,
    )
    session.add(entry)
    await session.flush()
    return entry


@dataclass(frozen=True, slots=True)
class ChainCheck:
    checked: int
    valid: bool
    first_bad_id: int | None
    reason: str | None


async def verify_chain(session: AsyncSession, batch: int = 5000) -> ChainCheck:
    """Walks the whole chain in id order and recomputes every hash."""
    prev_hash = GENESIS
    checked = 0
    last_id = 0
    while True:
        rows = (
            await session.scalars(
                select(AuditEntry)
                .where(AuditEntry.id > last_id)
                .order_by(AuditEntry.id)
                .limit(batch)
            )
        ).all()
        if not rows:
            return ChainCheck(checked, True, None, None)
        for e in rows:
            if e.prev_hash != prev_hash:
                return ChainCheck(checked, False, e.id, "Link to the previous entry is broken")
            expected = chain_hash(
                prev_hash, canonical(e.at, e.actor_id, e.action, e.entity_type, e.entity_id, e.data)
            )
            if expected != e.hash:
                return ChainCheck(checked, False, e.id, "Entry content does not match its hash")
            prev_hash = e.hash
            checked += 1
            last_id = e.id
