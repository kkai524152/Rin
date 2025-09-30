import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import Elysia, { t } from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { files } from "../db/schema";
import { eq } from "drizzle-orm";
import { setup } from "../setup";
import { getDB, getEnv } from "../utils/di";
import { createS3Client } from "../utils/s3";

function buf2hex(buffer: ArrayBuffer) {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

export function StorageService() {
    const env: Env = getEnv();
    const db = getDB();
    const endpoint = env.S3_ENDPOINT;
    const bucket = env.S3_BUCKET;
    const folder = env.S3_FOLDER || '';
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    const s3 = createS3Client();
    return new Elysia({ aot: false })
        .use(setup())
        .group('/storage', (group) =>
            group
                .post('/', async ({ uid, set, body: { key, file }, request }) => {

                    if (!endpoint) {
                        set.status = 500;
                        return 'S3_ENDPOINT is not defined'
                    }
                    if (!accessKeyId) {
                        set.status = 500;
                        return 'S3_ACCESS_KEY_ID is not defined'
                    }
                    if (!secretAccessKey) {
                        set.status = 500;
                        return 'S3_SECRET_ACCESS_KEY is not defined'
                    }
                    if (!bucket) {
                        set.status = 500;
                        return 'S3_BUCKET is not defined'
                    }
                    if (!uid) {
                        set.status = 401;
                        return 'Unauthorized';
                    }
                    const suffix = key.includes(".") ? key.split('.').pop() : "";
                    const hashArray = await crypto.subtle.digest(
                        { name: 'SHA-1' },
                        await file.arrayBuffer()
                    );
                    const hash = buf2hex(hashArray)
                    const hashkey = path.join(folder, hash + "." + suffix);
                    
                    // 生成文件ID：使用文件哈希 + 时间戳 + 随机数
                    const timestamp = Date.now().toString(36);
                    const random = Math.random().toString(36).substring(2, 8);
                    const fileId = `${hash.substring(0, 8)}_${timestamp}_${random}`;
                    try {
                        const response = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: hashkey, Body: file, ContentType: file.type }))
                        console.info(response);
                        
                        try {
                            // 尝试保存文件信息到数据库
                            const fileRecord = await db.insert(files).values({
                                id: fileId,
                                originalName: key,
                                storageKey: hashkey,
                                mimeType: file.type,
                                size: file.size,
                                uid: uid
                            }).returning({ id: files.id });
                            
                            const origin = (() => {
                                try { return new URL(request.url).origin } catch { return '' }
                            })();
                            return {
                                id: fileRecord[0].id,
                                url: `${accessHost}/${hashkey}`,
                                downloadUrl: origin ? `${origin}/storage/download/${fileRecord[0].id}` : `/storage/download/${fileRecord[0].id}`
                            }
                        } catch (dbError: any) {
                            // 如果数据库操作失败（比如files表不存在），使用原来的逻辑
                            console.warn('Database operation failed, using fallback:', dbError.message);
                            return `${accessHost}/${hashkey}`;
                        }
                    } catch (e: any) {
                        set.status = 400;
                        console.error(e.message)
                        return e.message
                    }
                }, {
                    body: t.Object({
                        key: t.String(),
                        file: t.File()
                    })
                })
                .get('/download/:id', async ({ set, params: { id } }) => {
                    if (!endpoint) {
                        set.status = 500;
                        return 'S3_ENDPOINT is not defined'
                    }
                    if (!accessKeyId) {
                        set.status = 500;
                        return 'S3_ACCESS_KEY_ID is not defined'
                    }
                    if (!secretAccessKey) {
                        set.status = 500;
                        return 'S3_SECRET_ACCESS_KEY is not defined'
                    }
                    if (!bucket) {
                        set.status = 500;
                        return 'S3_BUCKET is not defined'
                    }
                    
                    try {
                        // 尝试从数据库获取文件信息
                        const fileRecord = await db.select().from(files).where(eq(files.id, id)).limit(1);
                        if (fileRecord.length === 0) {
                            set.status = 404;
                            return 'File not found';
                        }
                        
                        const file = fileRecord[0];
                        
                        // 从S3获取文件
                        const response = await s3.send(new GetObjectCommand({
                            Bucket: bucket,
                            Key: file.storageKey
                        }));
                        
                        if (!response.Body) {
                            set.status = 404;
                            return 'File not found in storage';
                        }
                        
                        // 设置响应头，使用原始文件名（同时包含 filename 与 filename* 以兼容中文）
                        const headers = new Headers();
                        const asciiFallback = file.originalName.replace(/[^\x00-\x7F]/g, '_');
                        headers.set('Content-Type', file.mimeType || 'application/octet-stream');
                        headers.set('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
                        if (file.size) {
                            headers.set('Content-Length', file.size.toString());
                        }
                        
                        return new Response(response.Body as ReadableStream, {
                            status: 200,
                            headers: headers
                        });
                    } catch (e: any) {
                        // 如果数据库操作失败，返回错误
                        if (e.message.includes('no such table: files')) {
                            set.status = 503;
                            return 'File download service not available (database migration needed)';
                        }
                        set.status = 500;
                        console.error(e.message);
                        return e.message;
                    }
                })
                // 无需数据库的下载代理：/storage/f/<key>?name=<originalName>
                .get('/f/*', async ({ set, params, query }) => {
                    if (!endpoint) {
                        set.status = 500;
                        return 'S3_ENDPOINT is not defined'
                    }
                    if (!bucket) {
                        set.status = 500;
                        return 'S3_BUCKET is not defined'
                    }
                    const keyParam = params['*'];
                    if (!keyParam) {
                        set.status = 400;
                        return 'Missing key'
                    }
                    const originalName = typeof query.name === 'string' ? query.name : 'download';
                    try {
                        const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: keyParam }));
                        if (!response.Body) {
                            set.status = 404;
                            return 'File not found in storage';
                        }
                        const headers = new Headers();
                        const asciiFallback = originalName.replace(/[^\x00-\x7F]/g, '_');
                        const contentType = response.ContentType || 'application/octet-stream';
                        if (response.ContentLength) headers.set('Content-Length', String(response.ContentLength));
                        headers.set('Content-Type', contentType);
                        headers.set('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`);
                        return new Response(response.Body as ReadableStream, { status: 200, headers });
                    } catch (e: any) {
                        set.status = 500;
                        console.error(e.message);
                        return e.message;
                    }
                })
        );
}