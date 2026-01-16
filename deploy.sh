#!/bin/bash

# Script de déploiement pour EC2 Ubuntu
# Usage: ./deploy.sh

echo "🚀 Déploiement de l'application Cantine..."

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "app.js" ]; then
    echo "❌ Erreur: app.js non trouvé. Exécutez ce script depuis le répertoire racine du projet."
    exit 1
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install --production

# Créer les répertoires nécessaires
echo "📁 Création des répertoires..."
mkdir -p public/uploads/products
mkdir -p temp_uploads
mkdir -p logs

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Attention: Le fichier .env n'existe pas."
    echo "   Créez un fichier .env avec les variables d'environnement nécessaires."
    read -p "   Continuer quand même? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Redémarrer l'application avec PM2
if command -v pm2 &> /dev/null; then
    echo "🔄 Redémarrage de l'application avec PM2..."
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    pm2 save
    echo "✅ Application redémarrée avec succès!"
    echo "   Utilisez 'pm2 logs cantine' pour voir les logs"
else
    echo "⚠️  PM2 n'est pas installé. Démarrez l'application manuellement avec:"
    echo "   node app.js"
fi

echo "✨ Déploiement terminé!"
