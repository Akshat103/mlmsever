const Queue = require('bull');
const { BullAdapter } = require('bull-board');
const logger = require('../config/logger');

const registrationQueue = new Queue('registrationQueue');

registrationQueue.client.ping().then(() => {
  logger.info('Successfully connected to Redis');
}).catch(err => {
  logger.error('Redis connection error:', err);
});

// Queue event listeners for logging and debugging
registrationQueue.on('error', (error) => {
  logger.error('Queue error:', error);
});

registrationQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
});

registrationQueue.on('waiting', (jobId) => {
  logger.info(`Job ${jobId} is waiting`);
});

registrationQueue.on('stalled', (job) => {
  console.log(job)
  logger.warn(`Job ${job.id} stalled`);
});

registrationQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed with error: ${err.message}`);
});

registrationQueue.on('active', (job, jobPromise) => {
  logger.info(`Job ${job.id} is now active`);
});

registrationQueue.on('progress', (job, progress) => {
  logger.info(`Job ${job.id} is ${progress}% complete`);
});

registrationQueue.on('paused', () => {
  logger.warn('Queue is paused');
});

registrationQueue.on('resumed', (job) => {
  logger.info('Queue is resumed');
});

registrationQueue.on('drained', () => {
  logger.info('All jobs in the queue have been processed');
});

// Bull-Board integration for managing queues
const setQueues = () => {
  return [new BullAdapter(registrationQueue)];
};

module.exports = { registrationQueue, setQueues };
