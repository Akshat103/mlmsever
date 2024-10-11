const Queue = require('bull');
const { BullAdapter } = require('bull-board');

const registrationQueue = new Queue('registrationQueue');

registrationQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

const setQueues = () => {
  return new BullAdapter(registrationQueue);
};

module.exports = { registrationQueue, setQueues };
