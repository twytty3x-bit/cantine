const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Product = require('../models/Product');

async function fixImagePaths() {
    try {
        // Connexion à MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connecté à MongoDB');

        // Récupérer tous les produits
        const products = await Product.find();
        console.log(`\n=== Correction de ${products.length} produits ===\n`);

        const imagesDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
        if (!fs.existsSync(imagesDir)) {
            console.error(`Répertoire d'images introuvable: ${imagesDir}`);
            await mongoose.disconnect();
            return;
        }

        const allFiles = fs.readdirSync(imagesDir);
        console.log(`Fichiers disponibles: ${allFiles.length}\n`);

        let fixed = 0;
        let notFound = 0;

        for (const product of products) {
            if (product.image) {
                const imageName = path.basename(product.image);
                const imagePath = path.join(imagesDir, imageName);
                
                if (!fs.existsSync(imagePath)) {
                    // Chercher avec correspondance insensible à la casse
                    const foundFile = allFiles.find(f => {
                        // Correspondance exacte (insensible à la casse)
                        if (f.toLowerCase() === imageName.toLowerCase()) {
                            return true;
                        }
                        // Correspondance par nom sans extension
                        const fName = path.parse(f).name.toLowerCase();
                        const imgName = path.parse(imageName).name.toLowerCase();
                        return fName === imgName;
                    });
                    
                    if (foundFile) {
                        const correctPath = `/uploads/products/${foundFile}`;
                        product.image = correctPath;
                        await product.save();
                        console.log(`✓ Corrigé: ${product.name}`);
                        console.log(`  ${product.image} → ${correctPath}`);
                        fixed++;
                    } else {
                        console.log(`✗ Non trouvé: ${product.name} - ${product.image}`);
                        notFound++;
                    }
                } else {
                    // Le fichier existe déjà, vérifier que le chemin est correct
                    if (product.image !== `/uploads/products/${imageName}`) {
                        product.image = `/uploads/products/${imageName}`;
                        await product.save();
                        console.log(`✓ Chemin normalisé: ${product.name} - ${product.image}`);
                        fixed++;
                    }
                }
            }
        }

        console.log(`\n=== Résumé ===`);
        console.log(`Chemins corrigés: ${fixed}`);
        console.log(`Fichiers introuvables: ${notFound}`);

        await mongoose.disconnect();
        console.log('\nDéconnecté de MongoDB');
    } catch (error) {
        console.error('Erreur:', error);
        process.exit(1);
    }
}

fixImagePaths();
