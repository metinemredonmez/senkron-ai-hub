import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  queue: process.env.RABBITMQ_QUEUE || 'tourism-queue',
  exchange: process.env.RABBITMQ_EXCHANGE || 'tourism-exchange',
}));
