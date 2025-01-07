const redis = require('redis');
require('dotenv').config();

const client = redis.createClient({
    username: 'default',
    password: process.env.REDIS_PASS,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    },
});

client.on('error', (err) => {
    console.log(client);
    console.log('Redis Client Error', err);
});

(async () => {
    try {
        await client.connect();
        console.log('Connected to Redis!');
    } catch (err) {
        console.error('Could not connect to Redis:', err);
    }
})();

module.exports = client;
