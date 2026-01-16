const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function importInventaire() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connecté à MongoDB');

        // Vérifier si le fichier existe
        const filePath = path.join(__dirname, '..', 'cantine.xlsm');
        try {
            // Lecture du fichier Excel
            console.log('Lecture du fichier Excel...');
            const workbook = XLSX.readFile(filePath);
            
            if (!workbook.Sheets['Inventaire + Vente']) {
                throw new Error('Onglet "Inventaire + Vente" non trouvé');
            }

            const worksheet = workbook.Sheets['Inventaire + Vente'];
            
            // Conversion en JSON
            console.log('Conversion des données...');
            const data = XLSX.utils.sheet_to_json(worksheet);

            if (data.length === 0) {
                throw new Error('Aucune donnée trouvée dans le fichier');
            }

            // Nettoyage de la collection existante
            console.log('Nettoyage de la base de données...');
            await Product.deleteMany({});

            // Traitement des données
            console.log('Traitement des données...');
            const products = data.map(row => ({
                name: row['Nom du produit'],
                price: parseFloat(row['Prix de vente']) || 0,
                stock: parseInt(row['Quantité en stock']) || 0,
                category: determineCategory(row['Catégorie']),
                costPrice: parseFloat(row['Prix coûtant']) || 0,
                barcode: row['Code barre']?.toString()
            })).filter(product => product.name && product.price > 0); // Filtrer les produits invalides

            // Insertion dans la base de données
            console.log(`Importation de ${products.length} produits...`);
            await Product.insertMany(products);
            console.log('Importation réussie !');

        } catch (error) {
            if (error.code === 'ENOENT') {
                console.error('Erreur: Le fichier cantine.xlsm n\'a pas été trouvé');
                console.log('Assurez-vous que le fichier est présent à la racine du projet');
            } else {
                console.error('Erreur lors de la lecture du fichier:', error.message);
            }
        }
    } catch (error) {
        console.error('Erreur lors de l\'importation:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Déconnecté de MongoDB');
    }
}

function determineCategory(category) {
    const categories = {
        'Boisson': 'Boissons',
        'Bonbon': 'Bonbons',
        'Chocolat': 'Chocolats'
    };
    return categories[category] || 'Autres';
}

importInventaire(); 