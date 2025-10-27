import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  clientId: process.env.KAFKA_CLIENT_ID || 'tourism-backend',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  groupId: process.env.KAFKA_GROUP_ID || 'tourism-consumer-group',
  topics: {
    aiBridgeEvents:
      process.env.KAFKA_TOPIC_AI_BRIDGE ?? 'ai.bridge.events',
  },
}));
