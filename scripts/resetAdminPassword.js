require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function resetAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connecté à MongoDB');
        
        // Chercher l'utilisateur admin
        const admin = await User.findOne({ username: 'admin' });
        
        if (!admin) {
            console.log('Aucun utilisateur admin trouvé. Création d\'un nouvel utilisateur admin...');
            
            const newAdmin = new User({
                username: 'admin',
                password: 'admin',
                role: 'admin',
                active: true
            });
            
            await newAdmin.save();
            console.log('✓ Utilisateur admin créé avec succès');
            console.log('\nIdentifiants de connexion :');
            console.log('Username: admin');
            console.log('Password: admin');
        } else {
            // Réinitialiser le mot de passe
            admin.password = 'admin';
            await admin.save();
            
            console.log('✓ Mot de passe admin réinitialisé avec succès');
            console.log('\nIdentifiants de connexion :');
            console.log('Username: admin');
            console.log('Password: admin');
            console.log('\n⚠️  IMPORTANT: Changez ce mot de passe après votre première connexion !');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        process.exit(1);
    }
}

resetAdminPassword();
