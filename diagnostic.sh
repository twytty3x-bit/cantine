#!/bin/bash

echo "=========================================="
echo "DIAGNOSTIC DE L'APPLICATION CANTINE"
echo "=========================================="
echo ""

echo "=== 1. Statut PM2 ==="
pm2 status
echo ""

echo "=== 2. Dernières erreurs PM2 ==="
pm2 logs cantine --lines 30 --err
echo ""

echo "=== 3. Statut MongoDB ==="
sudo systemctl status mongod --no-pager -l
echo ""

echo "=== 4. Test connexion MongoDB ==="
if command -v mongosh &> /dev/null; then
    mongosh --eval "db.adminCommand('ping')" --quiet 2>&1 | head -5
else
    echo "mongosh non installé"
fi
echo ""

echo "=== 5. Statut Nginx ==="
sudo systemctl status nginx --no-pager -l
echo ""

echo "=== 6. Ports en écoute ==="
sudo netstat -tulpn | grep -E '3000|27017|80|443' || sudo ss -tulpn | grep -E '3000|27017|80|443'
echo ""

echo "=== 7. Vérification fichier .env ==="
if [ -f /var/www/cantine/.env ]; then
    echo "✓ Fichier .env existe"
    echo "Variables présentes (masquées):"
    grep -E "MONGODB_URI|JWT_SECRET|SESSION_SECRET|PORT|NODE_ENV" /var/www/cantine/.env | sed 's/=.*/=***/' || echo "Variables non trouvées"
else
    echo "✗ ERREUR: Fichier .env manquant dans /var/www/cantine/"
fi
echo ""

echo "=== 8. Test connexion locale ==="
curl -s -o /dev/null -w "Code HTTP: %{http_code}\n" http://localhost:3000 || echo "Impossible de se connecter au port 3000"
echo ""

echo "=== 9. Logs Nginx (dernières erreurs) ==="
sudo tail -n 20 /var/log/nginx/error.log 2>/dev/null || echo "Aucun log d'erreur"
echo ""

echo "=== 10. Configuration Nginx ==="
if [ -f /etc/nginx/sites-available/cantine ]; then
    echo "✓ Configuration trouvée"
    echo "Proxy vers:"
    grep "proxy_pass" /etc/nginx/sites-available/cantine || echo "proxy_pass non trouvé"
else
    echo "✗ Configuration Nginx non trouvée"
fi
echo ""

echo "=== 11. Firewall UFW ==="
sudo ufw status
echo ""

echo "=========================================="
echo "DIAGNOSTIC TERMINÉ"
echo "=========================================="
