const User = require('../models/User');

// ... autres initialisations ...

// Créer l'utilisateur admin par défaut
async function createDefaultAdmin() {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'admin',
                password: 'admin123', // À changer en production !
                role: 'admin',
                active: true
            });
            console.log('Utilisateur admin créé avec succès');
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'admin:', error);
    }
}

// Appeler la fonction lors de l'initialisation
createDefaultAdmin(); 