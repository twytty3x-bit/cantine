const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');
console.log('JWT_SECRET à ajouter dans votre fichier .env :');
console.log(secret); 