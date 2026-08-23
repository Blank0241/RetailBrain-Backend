import mongoose from 'mongoose';

const { Schema } = mongoose;

// These match src/data/mockData.js PREDICTION_LABELS / ACTUAL_OUTCOME_OPTIONS
// / StatusPill CONFIG in the frontend exactly. Do not change casing — the
// frontend switches on these literal strings.
export const PREDICTION_LABELS = ['Likely to Purchase', 'Unlikely to Purchase'];
export const ACTUAL_OUTCOME_OPTIONS = ['Purchased', 'Did Not Purchase', 'Not Known Yet'];
export const STATUS_VALUES = ['Pending', 'Correct', 'Incorrect'];

const predictionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Display name shown in PredictionTable/PredictionCard. Derived server-side
    // from inputData.customerId (or a lookup later), never trusted verbatim
    // from the client beyond basic sanitization.
    customer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    // Intentionally flexible: PREDICTION_FORM_CONFIG in the frontend can grow
    // new ML input fields without a schema migration. Validated at the API
    // boundary (see validators/predictionValidator.js), stored as-is here.
    inputData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    prediction: {
      type: String,
      enum: PREDICTION_LABELS,
      required: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    actualOutcome: {
      type: String,
      enum: ACTUAL_OUTCOME_OPTIONS,
      default: 'Not Known Yet',
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: 'Pending',
      index: true,
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true } // createdAt / updatedAt
);

predictionSchema.index({ userId: 1, createdAt: -1 });
predictionSchema.index({ userId: 1, status: 1 });
// Lightweight text-ish search support for History's `search` box
// (customer name / prediction id / inputData.customerId).
predictionSchema.index({ userId: 1, customer: 1 });

/**
 * Shape exactly matches what PredictionTable / PredictionResult /
 * PredictionDetails expect: { _id, userId, customer, inputData, prediction,
 * confidence, actualOutcome, status, createdAt, evaluatedAt }
 */
predictionSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id.toString(),
    userId: this.userId.toString(),
    customer: this.customer,
    inputData: this.inputData,
    prediction: this.prediction,
    confidence: this.confidence,
    actualOutcome: this.actualOutcome,
    status: this.status,
    createdAt: this.createdAt,
    evaluatedAt: this.evaluatedAt,
  };
};

export default mongoose.model('Prediction', predictionSchema);
