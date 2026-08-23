import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default queries
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// No explicit userSchema.index({ email: 1 }) here — `unique: true` on the
// field above already creates that index; adding another is redundant and
// triggers a Mongoose duplicate-index warning.

/**
 * Shape exactly matches MOCK_USER / what AuthContext + Profile.jsx expect:
 * { _id, name, email, createdAt }
 * Never includes passwordHash, __v, or updatedAt (frontend doesn't use it).
 */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    _id: this._id.toString(),
    name: this.name,
    email: this.email,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
