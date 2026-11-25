import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  appointmentNumber: {
    type: String,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerInfo: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  branch: {
    type: String,
    required: true
    // Removed enum - now accepts any branch name
  },
  appointmentDate: {
    type: Date,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  items: [{
    itemName: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    description: String
  }],
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  statusHistory: [{
    status: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  notes: String
}, {
  timestamps: true
});

/**
 * One booking per branch, day and time slot. The controller checks first for a friendly
 * message, but only this unique index makes it race-proof: if two customers submit the same
 * slot at the same moment, the second insert fails with a duplicate-key error (-> 409).
 * Cancelled appointments are excluded so a freed slot can be booked again.
 */
appointmentSchema.index(
  { branch: 1, appointmentDate: 1, appointmentTime: 1 },
  {
    unique: true,
    name: 'unique_active_slot',
    partialFilterExpression: { status: { $in: ['Pending', 'Approved', 'Completed'] } },
  },
);
appointmentSchema.index({ user: 1, appointmentDate: -1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;