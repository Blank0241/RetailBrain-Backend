import { callRandomForestModel } from '../services/mlService.js';

const features = {
  historical_view_count: 5,
  historical_cart_count: 1,
  historical_transaction_count: 0,
  historical_total_interactions: 6,
  days_since_last_interaction: 2,
  days_since_first_interaction: 10,
  previously_viewed: 1,
  previously_added_to_cart: 1,
  previously_purchased: 0,
  customer_total_views: 20,
  customer_total_carts: 3,
  customer_total_transactions: 0,
  customer_unique_items_viewed: 8,
  customer_unique_items_purchased: 0,
  customer_activity_frequency: 2,
  item_total_views: 100,
  item_total_carts: 10,
  item_total_transactions: 2,
  item_unique_visitors: 50,
};

try {
  const result = await callRandomForestModel(features);

  console.log('ML SERVICE TEST RESULT:');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('ML SERVICE TEST FAILED:');
  console.error(error);
  process.exit(1);
}