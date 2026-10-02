import mongoose from 'mongoose';

const { Schema } = mongoose;

const customerItemFeatureSchema = new Schema(
  {
    customerId: {
      type: String,
      required: true,
      index: true,
    },

    itemId: {
      type: String,
      required: true,
      index: true,
    },

    historical_view_count: Number,
    historical_cart_count: Number,
    historical_transaction_count: Number,
    historical_total_interactions: Number,
    days_since_last_interaction: Number,
    days_since_first_interaction: Number,
    previously_viewed: Number,
    previously_added_to_cart: Number,
    previously_purchased: Number,
    customer_total_views: Number,
    customer_total_carts: Number,
    customer_total_transactions: Number,
    customer_unique_items_viewed: Number,
    customer_unique_items_purchased: Number,
    customer_activity_frequency: Number,
    item_total_views: Number,
    item_total_carts: Number,
    item_total_transactions: Number,
    item_unique_visitors: Number,
  },
  { timestamps: true }
);

customerItemFeatureSchema.index(
  { customerId: 1, itemId: 1 },
  { unique: true }
);

export default mongoose.model(
  'CustomerItemFeature',
  customerItemFeatureSchema
);