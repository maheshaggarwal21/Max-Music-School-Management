'use strict';

const Institution       = require('../../../models/Institution');
const SlugChangeRequest = require('../../../models/SlugChangeRequest');
const { invalidateInstitution } = require('../../../middleware/resolveInstitution');
const { brandingPublic } = require('../../../config/instAuthHelpers');
const { generateSlug } = require('../../../config/specialFunctions');
const { presignUpload } = require('../../../config/s3');
const { auditLog, actorFromReq, diff } = require('../../../config/auditLog');
const { ok, created, badRequest, notFound } = require('../../../config/helper');
const S = require('../../../config/strings');

// ─────────────────────────────────────────────────────────────────────────────
// Admin school-profile settings. The admin may edit BRANDING (color, logo,
// tagline, display name) directly — every change is audited and the slug cache
// is busted so all panels pick it up. The SLUG is immutable here: the admin can
// only file a SlugChangeRequest that the operator approves from the operator
// panel.
// ─────────────────────────────────────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const BRANDING_EDITABLE = ['schoolName', 'primaryColor', 'tagline', 'logoUrl'];

exports.getProfile = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const pending = await SlugChangeRequest.findOne({ institutionId: inst, status: 'pending' })
      .sort({ createdAt: -1 }).lean();
    return ok(res, S.OK, {
      branding: brandingPublic(req.institution),
      pendingSlugRequest: pending ? {
        _id: String(pending._id),
        requestedSlug: pending.requestedSlug,
        createdAt: pending.createdAt,
      } : null,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateBranding = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const body = req.body || {};

    if (body.slug !== undefined) return badRequest(res, S.SLUG_REQUEST_INVALID);
    if (body.primaryColor !== undefined && !HEX_COLOR.test(String(body.primaryColor))) {
      return badRequest(res, S.BRANDING_INVALID);
    }
    if (body.schoolName !== undefined && !String(body.schoolName).trim()) {
      return badRequest(res, S.BRANDING_INVALID);
    }
    if (body.logoUrl !== undefined && body.logoUrl !== null && body.logoUrl !== '') {
      const v = String(body.logoUrl);
      const isDataImage = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(v) && v.length < 400_000;
      let isHttp = false;
      try { isHttp = ['http:', 'https:'].includes(new URL(v).protocol); } catch { /* not a URL */ }
      if (!isDataImage && !isHttp) return badRequest(res, S.BRANDING_INVALID);
    }

    const institution = await Institution.findOne({ _id: inst });
    if (!institution) return notFound(res, S.INST_NOT_FOUND);

    const before = institution.branding.toObject();
    for (const f of BRANDING_EDITABLE) {
      if (body[f] !== undefined) {
        institution.branding[f] = (body[f] === '' || body[f] === null) ? undefined : body[f];
      }
    }
    await institution.save();

    const changes = diff(before, institution.branding.toObject(), BRANDING_EDITABLE)
      .map(c => ({ ...c, field: `branding.${c.field}` }));
    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'UPDATE_BRANDING', entityType: 'Institution', entityId: institution._id,
      entityLabel: `Institution: ${institution.branding.schoolName}`,
      changes, ip: req.ip,
    });

    // Bust the slug cache so every panel sees the new branding immediately.
    invalidateInstitution(institution.slug);

    return ok(res, S.BRANDING_UPDATED, { branding: brandingPublic(institution.toObject()) });
  } catch (err) {
    next(err);
  }
};

exports.logoUploadUrl = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { filename, contentType } = req.body || {};
    if (!contentType || !/^image\//.test(String(contentType))) return badRequest(res, S.VALIDATION_FAILED);
    if (!process.env.AWS_S3_BUCKET) return badRequest(res, S.UPLOAD_NOT_CONFIGURED);

    const signed = await presignUpload({
      institutionId: String(inst), folder: 'branding',
      filename: filename || 'logo', contentType,
    });
    return ok(res, S.OK, signed);
  } catch (err) {
    next(err);
  }
};

exports.requestSlugChange = async (req, res, next) => {
  try {
    const inst = req.institution._id;
    const { requestedSlug, reason } = req.body || {};

    const candidate = generateSlug(requestedSlug);
    if (!candidate || candidate.length < 3) return badRequest(res, S.SLUG_REQUEST_INVALID);
    if (candidate !== String(requestedSlug || '').trim().toLowerCase()) {
      return badRequest(res, S.SLUG_REQUEST_INVALID);
    }
    if (candidate === req.institution.slug) return badRequest(res, S.SLUG_REQUEST_INVALID);

    const taken = await Institution.exists({ slug: candidate });
    if (taken) return badRequest(res, S.SLUG_REQUEST_TAKEN);

    const pending = await SlugChangeRequest.exists({ institutionId: inst, status: 'pending' });
    if (pending) return badRequest(res, S.SLUG_REQUEST_PENDING);

    const request = await SlugChangeRequest.create({
      institutionId: inst,
      currentSlug: req.institution.slug,
      requestedSlug: candidate,
      reason: reason || undefined,
      requestedBy: {
        actorId: String(req.actor._id),
        actorRole: 'institution_admin',
        actorName: req.actor.name,
      },
    });

    await auditLog({
      institutionId: inst, ...actorFromReq(req),
      action: 'REQUEST_SLUG_CHANGE', entityType: 'Institution', entityId: inst,
      entityLabel: `Institution: ${req.institution.branding.schoolName}`,
      changes: [{ field: 'slug (requested)', from: req.institution.slug, to: candidate }],
      ip: req.ip,
    });

    return created(res, S.SLUG_REQUEST_CREATED, {
      request: {
        _id: String(request._id),
        requestedSlug: request.requestedSlug,
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};
