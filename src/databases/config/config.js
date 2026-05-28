/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-env node */
require('dotenv').config();

const getSqliteStorage = (uri) => {
  if (uri && uri.startsWith('sqlite:')) {
    return uri.replace('sqlite:', '');
  }
  return 'main.sqlite';
};

const databaseUri = process.env.DATABASE_URI;
const isSqlite = databaseUri && databaseUri.startsWith('sqlite:');

const dbConfig = isSqlite
  ? {
      dialect: 'sqlite',
      storage: getSqliteStorage(databaseUri),
    }
  : {
      url: databaseUri,
      dialect: 'postgres',
    };

module.exports = {
  development: dbConfig,
  test: dbConfig,
  production: dbConfig,
};
