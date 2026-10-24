"""Shared domain vocabulary. Values are stored as strings in the database."""

from enum import IntEnum, StrEnum


class InstrumentKind(StrEnum):
    JOINT_FDR = "joint_fdr"
    RPGF = "rpgf"
    RTGS = "rtgs"


class Status(StrEnum):
    SUBMITTED = "submitted"
    UNDER_SCRUTINY = "under_scrutiny"
    RETURNED = "returned"
    DISCREPANCY = "discrepancy"
    ACTIVE = "active"
    MATURING = "maturing"
    MATURED = "matured"
    RENEWAL_PENDING = "renewal_pending"
    RENEWED = "renewed"
    RELEASE_REQUESTED = "release_requested"
    RELEASE_CLEARED = "release_cleared"
    RELEASED = "released"
    LIEN_HOLD = "lien_hold"
    FORFEITED = "forfeited"
    ENCASHED_PREMATURELY = "encashed_prematurely"


class Assurance(IntEnum):
    """Computed proof level. Never set by hand (PROJECT.md 3.3)."""

    DECLARED = 0
    DOCUMENT_CHECKED = 1
    BANK_CONFIRMED = 2
    RECONFIRMED = 3


class Source(StrEnum):
    DECLARED = "declared"
    EXTRACTED = "extracted"
    CONFIRMED = "confirmed"


class FieldName(StrEnum):
    NUMBER = "number"
    BANK = "bank"
    IFSC = "ifsc"
    AMOUNT = "amount"
    ISSUE_DATE = "issue_date"
    MATURITY_DATE = "maturity_date"
    HOLDERS = "holders"
    LIEN = "lien"


MATERIAL_FIELDS: tuple[FieldName, ...] = tuple(FieldName)


class MatchState(StrEnum):
    MATCH = "match"
    CONFLICT = "conflict"
    MISSING = "missing"
    PENDING = "pending"


class Role(StrEnum):
    BUREAU_OFFICER = "bureau_officer"
    SECTION_HEAD = "section_head"
    REGIONAL_OFFICER = "regional_officer"
    CELL_OFFICER = "cell_officer"
    APPROVING_AUTHORITY = "approving_authority"
    INSTITUTION_USER = "institution_user"
    BANK_OFFICER = "bank_officer"
    AUDITOR = "auditor"
    ADMIN = "admin"


OFFICER_ROLES: frozenset[Role] = frozenset(
    {
        Role.BUREAU_OFFICER,
        Role.SECTION_HEAD,
        Role.REGIONAL_OFFICER,
        Role.APPROVING_AUTHORITY,
        Role.AUDITOR,
        Role.ADMIN,
    }
)


class Cell(StrEnum):
    PGRC = "pgrc"
    VIGILANCE = "vigilance"
    GRANTS = "grants"


class Severity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Premises(StrEnum):
    OWN = "own"
    LEASED = "leased"


class Ownership(StrEnum):
    PRIVATE = "private"
    GOVERNMENT = "government"
    AIDED = "aided"
