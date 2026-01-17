const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

async function checkImages() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connecté à MongoDB');

        // Récupérer tous les produits
        const products = await Product.find();
        console.log(`\n=== Vérification de ${products.length} produits ===\n`);

        const imagesDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
        const allFiles = fs.existsSync(imagesDir) ? fs.readdirSync(imagesDir) : [];
        
        console.log(`Fichiers disponibles: ${allFiles.length}`);
        console.log(`Premiers fichiers: ${allFiles.slice(0, 5).join(', ')}...\n`);

        let found = 0;
        let notFound = 0;
        const notFoundList = [];

        for (const product of products) {
            if (product.image) {
                const imageName = path.basename(product.image);
                const imagePath = path.join(imagesDir, imageName);
                
                if (fs.existsSync(imagePath)) {
                    found++;
                    console.log(`✓ ${product.name}: ${product.image}`);
                } else {
                    notFound++;
                    // Chercher avec correspondance insensible à la casse
                    const foundFile = allFiles.find(f => f.toLowerCase() === imageName.toLowerCase());
                    if (foundFile) {
                        console.log(`✗ ${product.name}: ${product.image}}`)
                        console.log(`  → Fichier trouvé avec casse différente: ${foundFile}`);
                        console.log(`  → Chemin correct: /uploads/products/${foundFile}`);
                        notFoundList.push({
                            product: product.name,
                            current: product.image,
                            correct: `/uploads/products/${foundFile}`
                        });
                    } else {
                        console.log(`✗ ${product.name}: ${product.image} (FICHIER INTROUVABLE)`);
                        notFoundList.push({
                            product: product.name,
                            current: product.image,
                            correct: null
                        });
                    }
                }
            } else {
                console.log(`- ${product.name}: Pas d'image`);
            }
        }

        console.log(`\n=== Résumé ===`);
        console.log(`Images trouvées: ${found}`);
        console.log(`Images non trouvées: ${notFound}`);

        if (notFoundList.length > 0) {
            console.log(`\n=== Produits à corriger ===`);
            notFoundList.forEach(item => {
                console.log(`${item.product}:`);
                console.log(`  Actuel: ${item.current}`);
                if (item.correct) {
                    console.log(`  Correct: ${item.correct}`);
                } else {
                    console.log(`  Correct: FICHIER MANQUANT`);
                }
            });
        }

        await mongoose.disconnect();
        console.log('\nDéconnecté de MongoDB');
    } catch (error) {
        console.error('Erreur:', error);
        process.exit(1);
    }
}

checkImages();
