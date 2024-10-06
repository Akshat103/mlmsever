const Queue = require('bull');
const { BullAdapter } = require('bull-board');

// Create a new queue for handling commissions
const commissionQueue = new Queue('commissionQueue');

// Setup Bull Board monitoring for commissionQueue
const setCommissionQueue = () => {
  return new BullAdapter(commissionQueue);
};

module.exports = { commissionQueue, setCommissionQueue };
