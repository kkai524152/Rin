-- 备份现有数据
CREATE TABLE files_backup AS SELECT * FROM files;

-- 删除原表
DROP TABLE files;

-- 重新创建表，使用text类型的id
CREATE TABLE files (
    id TEXT PRIMARY KEY NOT NULL,
    original_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    uid INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    FOREIGN KEY (uid) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 迁移数据，为每个文件生成新的编码ID
INSERT INTO files (id, original_name, storage_key, mime_type, size, uid, created_at, updated_at)
SELECT 
    substr(hex(randomblob(16)), 1, 8) || '_' || 
    (strftime('%s', 'now') || substr(strftime('%f', 'now'), 4, 3)) || '_' || 
    substr(hex(randomblob(4)), 1, 6) as id,
    original_name,
    storage_key,
    mime_type,
    size,
    uid,
    created_at,
    updated_at
FROM files_backup;

-- 删除备份表
DROP TABLE files_backup;

-- 更新迁移版本
UPDATE info SET value = '6' WHERE key = 'migration_version';
