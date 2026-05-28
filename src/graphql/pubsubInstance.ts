import { PubSub as GSPubSub } from 'graphql-subscriptions';
import { logger } from '../helpers/logger';
import { customEnv } from '../helpers/customEnv';

let GSPubSubInstance: any = new GSPubSub();

if (customEnv.REDIS_HOST) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RedisPubSub } = require('graphql-redis-subscriptions');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require('ioredis');

    const options = {
      host: customEnv.REDIS_HOST,
      port: customEnv.REDIS_PORT ? Number(customEnv.REDIS_PORT) : 6379,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    };

    GSPubSubInstance = new RedisPubSub({
      publisher: new Redis(options),
      subscriber: new Redis(options),
    });
    logger.info('GraphQL Subscriptions: connected to Redis Pub/Sub');
  } catch (err) {
    logger.warn(
      'GraphQL Subscriptions: REDIS_HOST was provided but ioredis or graphql-redis-subscriptions is missing. Falling back to in-memory PubSub.'
    );
  }
}

// Adapter to match TypeGraphQL v2 PubSub interface
class TGPubSubAdapter {
  private inner: any;
  constructor(inner: any) {
    this.inner = inner;
  }
  // type-graphql expects void; underlying returns Promise, ignore
  publish(routingKey: string, ...args: unknown[]): void {
    // publish payload as first argument
    void this.inner.publish(routingKey, args[0] as any);
  }
  // return an AsyncIterable for the topic
  subscribe(routingKey: string, _dynamicId?: unknown): AsyncIterable<unknown> {
    const it = this.inner.asyncIterator(routingKey as any) as AsyncIterator<unknown>;
    const asyncIterable: AsyncIterable<unknown> & AsyncIterator<unknown> = {
      next(...args: [] | [undefined]) {
        return it.next(...args);
      },
      return(value?: unknown) {
        return typeof it.return === 'function'
          ? it.return(value)
          : Promise.resolve({ value: undefined, done: true } as any);
      },
      throw(err?: unknown) {
        return typeof it.throw === 'function' ? it.throw(err) : Promise.reject(err);
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    return asyncIterable;
  }
}

export const pubSub = new TGPubSubAdapter(GSPubSubInstance);
