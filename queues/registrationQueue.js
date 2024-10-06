const Queue = require('bull');
const { BullAdapter } = require('bull-board');

const registrationQueue = new Queue('registrationQueue');

const setQueues = () => {
  return new BullAdapter(registrationQueue);
};

module.exports = { registrationQueue, setQueues };
