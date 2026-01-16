require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdminUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Vérifier si l'admin existe déjà
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('L\'utilisateur admin existe déjà');
            process.exit(0);
        }

        const adminUser = new User({
            username: 'admin',
            password: 'admin',
            role: 'admin',
            active: true
        });

        await adminUser.save();
        console.log('Utilisateur admin créé avec succès');
        
        // Afficher les informations de connexion
        console.log('Identifiants de connexion :');
        console.log('Username: admin');
        console.log('Password: admin');
        
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors de la création de l\'admin:', error);
        process.exit(1);
    }
}

createAdminUser();