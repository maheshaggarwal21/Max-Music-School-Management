'use strict';

const mongoose = require('mongoose');

let connected = false;

async function connect() {
  if (connected) return mongoose.connection;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 50,
  });

  connected = true;
  console.log('[db] connected');

  mongoose.connection.on('error', err => console.error('[db] error', err));
  mongoose.connection.on('disconnected', () => {
    connected = false;
    console.warn('[db] disconnected');
  });

  return mongoose.connection;
}

async function disconnect() {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

module.exports = { connect, disconnect };
