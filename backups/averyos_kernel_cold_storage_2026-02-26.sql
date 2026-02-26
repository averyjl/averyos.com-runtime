PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE kernel_locks (   hardware TEXT PRIMARY KEY,   sha_anchor TEXT,   creator TEXT,   status TEXT );
INSERT INTO "kernel_locks" VALUES('JLA-EDK-2022','cf83e135...','Jason Lee Avery','ACTIVE_ANCHOR');
CREATE TABLE site_blocks (   block_id TEXT PRIMARY KEY,   content JSON,   last_updated DATETIME DEFAULT CURRENT_TIMESTAMP );
INSERT INTO "site_blocks" VALUES('public_start_portal','{"title": "AveryOS Sovereign Portal", "status": "ACTIVE", "version": "v3.6.2"}','2026-02-26 17:50:05');
