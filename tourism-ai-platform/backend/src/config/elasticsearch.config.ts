import { registerAs } from '@nestjs/config';

export default registerAs('elasticsearch', () => ({
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'tourism',
}));
