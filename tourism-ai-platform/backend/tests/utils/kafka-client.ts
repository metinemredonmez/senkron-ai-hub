import { Kafka, logLevel } from 'kafkajs';

const brokersEnv = process.env.KAFKA_BROKERS ?? 'localhost:9092';
const brokers = brokersEnv
  .split(',')
  .map((broker) => broker.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: 'tenant-smoke-tests',
  brokers,
  logLevel: logLevel.NOTHING,
});

export async function getKafkaTopics(): Promise<string[]> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const topics = await admin.listTopics();
    return topics;
  } finally {
    await admin.disconnect();
  }
}
