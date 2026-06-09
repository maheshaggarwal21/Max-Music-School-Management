'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const BrandingSchema = new mongoose.Schema(
  {
    schoolName:   { type: String, required: true, trim: true },
    logoUrl:      { type: String, trim: true },
    primaryColor: { type: String, default: '#5B8DEF', trim: true },
    tagline:      { type: String, trim: true },
  },
  { _id: false }
);

const RentSchema = new mongoose.Schema(
  {
    amount:        { type: Number, required: true, min: 0 },
    billingCycle:  { type: String, enum: ['monthly'], default: 'monthly' },
    nextDueDate:   { type: Date },
  },
  { _id: false }
);

const InstitutionSchema = new mongoose.Schema(
  {
    name:                 { type: String, required: true, trim: true },
    slug:                 { type: String, required: true, unique: true, lowercase: true, trim: true, immutable: true },
    mode:                 { type: String, enum: ['managed', 'autonomous'], required: true, default: 'managed' },
    status:               { type: String, enum: ['pending', 'active', 'suspended', 'terminated'], default: 'pending', required: true },
    ownerTeacherId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    createdByOperatorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Operator', required: true },
    contactEmail:         { type: String, required: true, lowercase: true, trim: true },
    branding:             { type: BrandingSchema, required: true },
    rent:                 { type: RentSchema },
    tokenVersion:         { type: Number, default: 0 },
    activatedAt:          { type: Date },
    suspendedAt:          { type: Date },
    terminatedAt:         { type: Date },
  },
  { timestamps: true }
);

// Defense in depth — block slug changes via any update operator
InstitutionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() || {};
  const hasSlug =
    update.slug ||
    (update.$set && update.$set.slug) ||
    (update.$setOnInsert && update.$setOnInsert.slug);
  if (hasSlug) return next(new Error('Institution slug is immutable'));
  next();
});

InstitutionSchema.index({ status: 1 });
InstitutionSchema.index({ mode: 1 });
InstitutionSchema.index({ ownerTeacherId: 1 });

InstitutionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Institution', InstitutionSchema);
