# Cantine - Système de Gestion de Point de Vente

Application web complète pour la gestion d'une cantine avec système de point de vente (POS) et panneau d'administration.

## 🚀 Fonctionnalités

### Point de Vente (POS)
- Interface tactile optimisée pour iPad
- Affichage des produits par catégorie
- Gestion du panier avec calcul automatique
- Système de coupons (pourcentage ou montant fixe)
- Calcul automatique de la monnaie à rendre
- Gestion des stocks en temps réel
- Prix par quantité (remises pour quantités importantes)

### Administration
- **Inventaire** : Gestion complète des produits (CRUD) avec upload d'images
- **Ventes** : Historique des transactions avec statistiques
- **Rapports** : 
  - Ventes par produit et par catégorie
  - Statistiques de profit
  - Utilisation des coupons
- **Catégories** : Gestion des catégories de produits
- **Coupons** : Création et gestion des coupons de réduction
- **Utilisateurs** : Gestion des comptes utilisateurs avec rôles (admin/user)

## 🛠️ Technologies

- **Backend** : Node.js, Express.js
- **Base de données** : MongoDB avec Mongoose
- **Authentification** : JWT (JSON Web Tokens)
- **Frontend** : EJS (Embedded JavaScript)
- **Upload** : Multer pour les images
- **Sessions** : Express-session avec stockage MongoDB

## 📋 Prérequis

- Node.js (v14 ou supérieur)
- MongoDB (local ou Atlas)
- npm ou yarn

## 🔧 Installation

1. Cloner le dépôt :
```bash
git clone https://github.com/twytty3x-bit/cantine.git
cd cantine
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
Créer un fichier `.env` à la racine du projet :
```env
MONGODB_URI=mongodb://localhost:27017/cantine
JWT_SECRET=votre_secret_jwt_ici
SESSION_SECRET=votre_secret_session_ici
PORT=3000
NODE_ENV=development
```

4. Générer les secrets (optionnel) :
```bash
node scripts/generateSecret.js
```

5. Créer un utilisateur administrateur :
```bash
node scripts/createAdmin.js
```

6. Démarrer l'application :
```bash
npm start
```

Pour le développement avec rechargement automatique :
```bash
npm run dev
```

## 🔐 Sécurité

- Authentification obligatoire pour accéder au POS et à l'administration
- Protection contre les attaques par force brute (rate limiting)
- Headers de sécurité HTTP configurés
- Cookies sécurisés (httpOnly, sameSite, secure en production)
- Validation des entrées utilisateur
- Protection XSS et CSRF

## 📱 Responsive Design

L'interface est optimisée pour :
- **iPad Pro** (1024px - 1366px)
- **iPad standard** (768px - 1023px)
- **iPad Mini** (640px - 767px)
- Mode paysage et portrait
- Interface tactile optimisée

## 📁 Structure du projet

```
Cantine/
├── app.js                 # Point d'entrée de l'application
├── routes/                # Routes Express
│   ├── index.js          # Route POS
│   ├── admin.js          # Routes administration
│   ├── auth.js           # Authentification
│   └── api.js            # API REST
├── models/               # Modèles Mongoose
│   ├── User.js
│   ├── Product.js
│   ├── Category.js
│   ├── Sale.js
│   └── Coupon.js
├── views/                # Templates EJS
│   ├── index.ejs         # Page POS
│   ├── login.ejs         # Page de connexion
│   └── admin/            # Pages administration
├── public/               # Fichiers statiques
│   ├── css/
│   ├── js/
│   └── uploads/
├── middleware/           # Middlewares Express
│   └── auth.js
└── scripts/              # Scripts utilitaires
    ├── createAdmin.js
    ├── importInventaire.js
    └── resetAdminPassword.js
```

## 🔑 Scripts disponibles

- `npm start` : Démarrer l'application
- `npm run dev` : Démarrer en mode développement avec nodemon
- `npm run import-inventory` : Importer un inventaire depuis Excel
- `npm run reset-admin` : Réinitialiser le mot de passe admin

## 📝 Variables d'environnement

| Variable | Description | Requis |
|----------|-------------|--------|
| `MONGODB_URI` | URI de connexion MongoDB | Oui |
| `JWT_SECRET` | Secret pour signer les tokens JWT | Oui |
| `SESSION_SECRET` | Secret pour les sessions | Oui |
| `PORT` | Port du serveur (défaut: 3000) | Non |
| `NODE_ENV` | Environnement (development/production) | Non |

## 🚨 Notes importantes

- Ne jamais commiter le fichier `.env` contenant les secrets
- Les images uploadées sont stockées dans `public/uploads/products/`
- En production, configurer `NODE_ENV=production` pour activer les cookies sécurisés HTTPS

## 📄 Licence

Ce projet est privé et destiné à un usage interne.

## 👤 Auteur

Développé pour la gestion de cantine.
