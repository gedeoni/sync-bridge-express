import { Joi } from 'celebrate';

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_URI: Joi.string().required(),
  DB_SCHEMA: Joi.string().optional().allow(''),
  AUTHORIZATION_KEY: Joi.string().required(),
  APP_PORT: Joi.number().default(4007),
  APP_NAME: Joi.string().default('exporter-middleware'),
  MID_MAIN_HOST: Joi.string().optional().allow(''),
  MID_SLAVE_ONE: Joi.string().optional().allow(''),
  REDIS_HOST: Joi.string().optional().allow(''),
  REDIS_PORT: Joi.number().optional(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

export const customEnv = {
  NODE_ENV: envVars.NODE_ENV,
  DATABASE_URI: envVars.DATABASE_URI,
  DB_SCHEMA: envVars.DB_SCHEMA,
  AUTHORIZATION_KEY: envVars.AUTHORIZATION_KEY,
  APP_PORT: envVars.APP_PORT,
  APP_NAME: envVars.APP_NAME,
  MAIN_HOST: envVars.MID_MAIN_HOST,
  SLAVE_ONE: envVars.MID_SLAVE_ONE,
  REDIS_HOST: envVars.REDIS_HOST,
  REDIS_PORT: envVars.REDIS_PORT,
};
