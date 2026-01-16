const mongoose = require('mongoose');
const TicketConfig = require('../models/TicketConfig');
require('dotenv').config();

async function initTicketConfig() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connexion à MongoDB réussie');

        // Vérifier si une configuration existe déjà
        const existingConfig = await TicketConfig.findOne({ active: true });
        
        if (existingConfig) {
            console.log('Configuration des tickets déjà existante');
            console.log('Prix de base:', existingConfig.basePrice);
            console.log('Offres:', existingConfig.quantityOffers);
        } else {
            // Créer une configuration par défaut
            const defaultConfig = new TicketConfig({
                basePrice: 0.50,
                quantityOffers: [],
                active: true
            });
            
            await defaultConfig.save();
            console.log('Configuration par défaut créée avec succès');
            console.log('Prix de base:', defaultConfig.basePrice);
        }
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Erreur:', error);
        process.exit(1);
    }
}

initTicketConfig();
