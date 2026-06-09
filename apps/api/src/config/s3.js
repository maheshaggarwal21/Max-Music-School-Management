'use strict';

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

let _client = null;

function client() {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  });
  return _client;
}

function bucket() {
  const b = process.env.AWS_S3_BUCKET;
  if (!b) throw new Error('AWS_S3_BUCKET not set');
  return b;
}

function publicUrl(key) {
  const b = bucket();
  const r = process.env.AWS_REGION || 'ap-south-1';
  return `https://${b}.s3.${r}.amazonaws.com/${key}`;
}

function buildKey({ institutionId, folder, filename }) {
  const safe = String(filename || 'file').replace(/[^\w.\-]/g, '_');
  const rand = crypto.randomBytes(8).toString('hex');
  return `institutions/${institutionId}/${folder || 'misc'}/${rand}-${safe}`;
}

async function presignUpload({ institutionId, folder, filename, contentType, expiresIn = 300 }) {
  if (!institutionId) throw new Error('institutionId required');
  const key = buildKey({ institutionId, folder, filename });
  const cmd = new PutObjectCommand({
    Bucket:      bucket(),
    Key:         key,
    ContentType: contentType || 'application/octet-stream',
  });
  const url = await getSignedUrl(client(), cmd, { expiresIn });
  return { uploadUrl: url, key, publicUrl: publicUrl(key), expiresIn };
}

async function deleteObject(key) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = { presignUpload, deleteObject, publicUrl, buildKey };
