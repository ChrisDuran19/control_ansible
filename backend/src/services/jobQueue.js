const { Queue } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const jobQueue = new Queue('conductor-jobs', { connection });

const createJob = async (jobType, jobData) => {
  try {
    const job = await jobQueue.add(jobType, jobData, {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      delay: 1000 // Delay de 1 segundo antes de procesar
    });

    console.log(`✅ Job ${jobType} encolado con ID: ${job.id}`);
    return job;
  } catch (error) {
    console.error('❌ Error encolando job:', error);
    throw error;
  }
};

// Función para obtener estadísticas de la cola
const getQueueStats = async () => {
  try {
    const waiting = await jobQueue.getWaiting();
    const active = await jobQueue.getActive();
    const completed = await jobQueue.getCompleted();
    const failed = await jobQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
};

module.exports = { jobQueue, createJob, getQueueStats };