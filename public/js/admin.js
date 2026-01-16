// Gestion des onglets
document.querySelectorAll('.admin-menu li').forEach(tab => {
    tab.addEventListener('click', () => {
        // Retirer la classe active de tous les onglets
        document.querySelectorAll('.admin-menu li').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Activer l'onglet cliqué
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        
        // Charger les données appropriées
        if (tab.dataset.tab === 'inventory') {
            loadInventory();
        } else if (tab.dataset.tab === 'sales') {
            loadSales();
        } else if (tab.dataset.tab === 'reports') {
            loadReports();
        } else if (tab.dataset.tab === 'categories') {
            loadCategories();
        } else if (tab.dataset.tab === 'coupons') {
            loadCoupons();
        } else if (tab.dataset.tab === 'users') {
            loadUsers();
        }
    });
});

// Gestion de l'inventaire
async function loadInventory() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        const tbody = document.querySelector('#inventory-table tbody');
        tbody.innerHTML = '';
        
        products.forEach(product => {
            const stockStatus = getStockStatus(product.stock);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="product-image-cell">
                    <img src="${product.image || '/images/default-product.png'}" alt="${product.name}">
                </td>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${product.price.toFixed(2)}$</td>
                <td>${product.costPrice.toFixed(2)}$</td>
                <td>
                    <span class="stock-status ${stockStatus.class}">
                        ${product.stock} en stock
                    </span>
                </td>
                <td class="actions-cell">
                    <button onclick="editProduct('${product._id}')" class="btn-edit" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduct('${product._id}')" class="btn-delete" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erreur lors du chargement de l\'inventaire:', error);
    }
}

// Ajouter une fonction pour déterminer le statut du stock
function getStockStatus(stock) {
    if (stock <= 0) {
        return { class: 'stock-out', text: 'Rupture' };
    } else if (stock <= 5) {
        return { class: 'stock-low', text: 'Faible' };
    } else {
        return { class: 'stock-normal', text: 'Normal' };
    }
}

// Gestion du modal des produits
const productModal = document.getElementById('product-modal');
let editingProductId = null;

// Modifier la gestion des modals et des boutons de fermeture
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser la référence au modal des catégories
    categoryModal = document.getElementById('category-modal');
    
    // Initialiser les gestionnaires de fermeture pour tous les modals
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.onclick = function() {
            this.closest('.modal').classList.remove('show');
        };
    });

    // Gérer la soumission du formulaire de catégorie
    document.getElementById('category-form').onsubmit = async (e) => {
        e.preventDefault();
        
        const categoryData = {
            name: document.getElementById('category-name').value,
            active: document.getElementById('category-active').checked
        };

        try {
            const url = editingCategoryId ? 
                `/api/categories/${editingCategoryId}` : '/api/categories';
            const method = editingCategoryId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryData)
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la sauvegarde');
            }
            
            categoryModal.classList.remove('show');
            loadCategories();
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            alert('Erreur lors de la sauvegarde de la catégorie');
        }
    };

    // Charger les données initiales
    loadInventory();
    loadCategories();
});

// Fonctions pour les produits
function openAddProductModal() {
    editingProductId = null;
    document.querySelector('#product-modal h2').textContent = 'Ajouter un produit';
    document.getElementById('product-form').reset();
    productModal.classList.add('show');
}

async function editProduct(productId) {
    try {
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();
        
        editingProductId = productId;
        document.querySelector('#product-modal h2').textContent = 'Modifier le produit';
        
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-cost').value = product.costPrice;
        document.getElementById('product-stock').value = product.stock;
        
        productModal.classList.add('show');
    } catch (error) {
        console.error('Erreur lors du chargement du produit:', error);
    }
}

async function deleteProduct(productId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
        try {
            await fetch(`/api/products/${productId}`, { method: 'DELETE' });
            loadInventory();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    }
}

// Ajouter cette fonction utilitaire
function parseLocalFloat(value) {
    // Remplacer la virgule par un point pour la conversion
    return parseFloat(value.toString().replace(',', '.'));
}

// Modifier la fonction de soumission du formulaire de produit
document.getElementById('product-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('product-name').value);
    formData.append('category', document.getElementById('product-category').value);
    formData.append('price', parseLocalFloat(document.getElementById('product-price').value));
    formData.append('costPrice', parseLocalFloat(document.getElementById('product-cost').value));
    formData.append('stock', document.getElementById('product-stock').value);
    
    const imageFile = document.getElementById('product-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }

    try {
        const url = editingProductId ? 
            `/api/products/${editingProductId}` : '/api/products';
        const method = editingProductId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la sauvegarde');
        }

        productModal.classList.remove('show');
        loadInventory();
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        alert(error.message);
    }
};

// Gestion des catégories
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const tbody = document.querySelector('#categories-table tbody');
        tbody.innerHTML = '';
        
        categories.forEach(category => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${category.name}</td>
                <td>
                    <span class="status-badge ${category.active ? 'active' : 'inactive'}">
                        ${category.active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td class="actions-cell">
                    <button onclick="editCategory('${category._id}')" class="btn btn-edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCategory('${category._id}')" class="btn btn-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        updateProductCategorySelect(categories);
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
    }
}

let editingCategoryId = null;

function openAddCategoryModal() {
    editingCategoryId = null;
    document.querySelector('#category-modal h2').textContent = 'Ajouter une catégorie';
    document.getElementById('category-form').reset();
    categoryModal.classList.add('show');
}

async function editCategory(categoryId) {
    try {
        const response = await fetch(`/api/categories/${categoryId}`);
        if (!response.ok) {
            throw new Error('Erreur lors de la récupération de la catégorie');
        }
        
        const category = await response.json();
        console.log('Catégorie reçue:', category); // Pour déboguer
        
        // Vérifier que nous avons bien reçu un objet catégorie valide
        if (!category || !category.name) {
            throw new Error('Données de catégorie invalides');
        }
        
        editingCategoryId = categoryId;
        document.querySelector('#category-modal h2').textContent = 'Modifier la catégorie';
        
        // Remplir le formulaire avec les données de la catégorie
        const nameInput = document.getElementById('category-name');
        const activeCheckbox = document.getElementById('category-active');
        
        if (!nameInput || !activeCheckbox) {
            throw new Error('Éléments du formulaire non trouvés');
        }
        
        nameInput.value = category.name;
        activeCheckbox.checked = category.active;
        
        // Afficher le modal
        const modal = document.getElementById('category-modal');
        if (!modal) {
            throw new Error('Modal non trouvé');
        }
        modal.classList.add('show');
        
    } catch (error) {
        console.error('Erreur détaillée:', error);
        alert(`Erreur lors du chargement de la catégorie: ${error.message}`);
    }
}

async function deleteCategory(categoryId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
        try {
            await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
            loadCategories();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    }
}

function updateProductCategorySelect(categories) {
    const select = document.getElementById('product-category');
    select.innerHTML = '';
    categories.filter(c => c.active).forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        select.appendChild(option);
    });
}

// Gestion des ventes
async function loadSales() {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        let url = '/api/sales';
        if (startDate && endDate) {
            url += `?start=${startDate}&end=${endDate}`;
        }
        
        const response = await fetch(url);
        const sales = await response.json();
        
        // Mettre à jour les statistiques
        let totalSales = 0;
        let totalProfit = 0;
        
        sales.forEach(sale => {
            totalSales += sale.total;
            totalProfit += sale.profit;
        });
        
        document.getElementById('total-sales').textContent = totalSales.toFixed(2) + '$';
        document.getElementById('total-profit').textContent = totalProfit.toFixed(2) + '$';
        document.getElementById('sales-count').textContent = sales.length;
        
        displaySales(sales);
    } catch (error) {
        console.error('Erreur lors du chargement des ventes:', error);
    }
}

let currentSaleId = null;

async function displaySales(sales) {
    const tbody = document.querySelector('#sales-table tbody');
    tbody.innerHTML = '';
    
    sales.forEach(sale => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(sale.date)}</td>
            <td>${formatSaleItems(sale.items)}</td>
            <td>${sale.total.toFixed(2)}$</td>
            <td>${sale.profit.toFixed(2)}$</td>
            <td>${sale.coupon && sale.coupon.code ? sale.coupon.code : 'Aucun coupon'}</td>
            <td class="sale-actions">
                <button onclick="editSale('${sale._id}')" class="edit-sale-btn" title="Modifier">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="confirmDeleteSale('${sale._id}')" class="delete-sale-btn" title="Supprimer">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('fr-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatSaleItems(items) {
    return items.map(item => 
        `${item.product.name} (${item.quantity}x à ${item.price.toFixed(2)}$)`
    ).join('<br>');
}

// Ajouter la gestion des images
document.getElementById('product-image').onchange = function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('image-preview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" alt="Prévisualisation">`;
            preview.style.display = 'block';
        }
        reader.readAsDataURL(file);
    } else {
        preview.style.display = 'none';
    }
};

async function editSale(saleId) {
    try {
        const response = await fetch(`/api/sales/${saleId}`);
        const sale = await response.json();
        
        currentSaleId = saleId;
        const form = document.getElementById('sale-form');
        const itemsContainer = form.querySelector('.sale-items');
        
        itemsContainer.innerHTML = sale.items.map((item, index) => `
            <div class="sale-item">
                <span>${item.product.name}</span>
                <input type="number" 
                       value="${item.quantity}" 
                       min="1" 
                       onchange="updateSaleItemQuantity(${index}, this.value)">
                <span>${item.price.toFixed(2)}$</span>
            </div>
        `).join('');
        
        document.getElementById('payment-received').value = sale.amountReceived || sale.total;
        
        document.getElementById('sale-modal').classList.add('show');
    } catch (error) {
        console.error('Erreur lors du chargement de la vente:', error);
        alert('Erreur lors du chargement de la vente');
    }
}

async function saveSale(e) {
    e.preventDefault();
    
    try {
        const response = await fetch(`/api/sales/${currentSaleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amountReceived: parseFloat(document.getElementById('payment-received').value)
            })
        });

        if (!response.ok) throw new Error('Erreur lors de la mise à jour');

        document.getElementById('sale-modal').classList.remove('show');
        loadSales();
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        alert('Erreur lors de la sauvegarde de la vente');
    }
}

function confirmDeleteSale(saleId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette vente ?')) {
        deleteSale(saleId);
    }
}

async function deleteSale(saleId) {
    try {
        const response = await fetch(`/api/sales/${saleId}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Erreur lors de la suppression');

        loadSales();
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la vente');
    }
}

// Ajouter ces gestionnaires d'événements dans la fonction setupEventListeners
document.getElementById('sale-form').onsubmit = saveSale;

// Fonction pour créer le graphique des ventes
function createSalesChart(products) {
    const ctx = document.getElementById('sales-by-product-chart').getContext('2d');
    
    if (window.salesChart) {
        window.salesChart.destroy();
    }

    window.salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: products.map(p => p._id.name),
            datasets: [{
                label: 'Ventes ($)',
                data: products.map(p => p.totalRevenue),
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => value.toFixed(2) + '$'
                    }
                }
            }
        }
    });
}

// Fonction pour créer le graphique des profits
function createProfitChart(products) {
    const ctx = document.getElementById('product-profit-chart').getContext('2d');
    
    if (window.profitChart) {
        window.profitChart.destroy();
    }

    // Calculer les profits
    const profitData = products.map(product => ({
        name: product._id.name,
        profit: product.totalRevenue - (product.totalQuantity * product._id.costPrice)
    }));

    window.profitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: profitData.map(p => p.name),
            datasets: [{
                label: 'Profit ($)',
                data: profitData.map(p => p.profit),
                backgroundColor: profitData.map(p => 
                    p.profit >= 0 ? 'rgba(46, 204, 113, 0.5)' : 'rgba(231, 76, 60, 0.5)'
                ),
                borderColor: profitData.map(p => 
                    p.profit >= 0 ? 'rgba(46, 204, 113, 1)' : 'rgba(231, 76, 60, 1)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => value.toFixed(2) + '$'
                    }
                }
            }
        }
    });
}

// Fonction pour mettre à jour les statistiques
function updateStats(stats) {
    if (!stats) return;
    
    document.getElementById('total-sales').textContent = 
        `${stats.totalSales.toFixed(2)}$`;
    document.getElementById('total-profit').textContent = 
        `${stats.totalProfit.toFixed(2)}$`;
    document.getElementById('sales-count').textContent = 
        stats.count;
}

// Ajouter la fonction pour filtrer les ventes
function filterSales() {
    loadSales();
}

// Ajouter la fonction de chargement des rapports
async function loadReports() {
    try {
        // Afficher les messages de chargement...
        const loadingMessage = '<tr><td colspan="4" class="loading">Chargement des données...</td></tr>';
        document.querySelector('#product-sales-table tbody').innerHTML = loadingMessage;
        document.querySelector('#category-sales-table tbody').innerHTML = 
            '<tr><td colspan="3" class="loading">Chargement des données...</td></tr>';

        // Réinitialiser les statistiques globales
        document.getElementById('total-sales-value').textContent = '0.00$';
        document.getElementById('total-profit-value').textContent = '0.00$';
        document.getElementById('total-transactions-value').textContent = '0';

        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;
        
        let url = '/api/stats';
        if (startDate && endDate) {
            url += `?start=${startDate}&end=${endDate}`;
        }

        console.log('1. Début du chargement des données');
        const response = await fetch(url);
        console.log('2. Réponse reçue:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('3. Erreur de réponse:', errorText);
            throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('4. Données reçues:', data);

        // Vérifier la structure des données
        if (!data || typeof data !== 'object') {
            console.error('5. Structure de données invalide:', data);
            throw new Error('Format de données invalide');
        }

        // Afficher les statistiques globales
        if (data.overall) {
            console.log('6. Mise à jour des statistiques globales');
            document.getElementById('total-sales-value').textContent = 
                `${Number(data.overall.totalSales || 0).toFixed(2)}$`;
            document.getElementById('total-profit-value').textContent = 
                `${Number(data.overall.totalProfit || 0).toFixed(2)}$`;
            document.getElementById('total-transactions-value').textContent = 
                data.overall.count || 0;
        }

        // Afficher les ventes par produit
        console.log('7. Mise à jour des ventes par produit');
        const productTableBody = document.querySelector('#product-sales-table tbody');
        if (data.popularProducts && Array.isArray(data.popularProducts) && data.popularProducts.length > 0) {
            productTableBody.innerHTML = '';
            data.popularProducts.forEach(product => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${product.name || 'N/A'}</td>
                    <td>${product.totalQuantity || 0}</td>
                    <td>${Number(product.totalSales || 0).toFixed(2)}$</td>
                    <td>${Number(product.profit || 0).toFixed(2)}$</td>
                `;
                productTableBody.appendChild(tr);
            });
        } else {
            productTableBody.innerHTML = 
                '<tr><td colspan="4" class="no-data">Aucune donnée disponible</td></tr>';
        }

        // Afficher les ventes par catégorie
        console.log('8. Mise à jour des ventes par catégorie');
        const categoryTableBody = document.querySelector('#category-sales-table tbody');
        if (data.categoryStats && Array.isArray(data.categoryStats) && data.categoryStats.length > 0) {
            categoryTableBody.innerHTML = '';
            data.categoryStats.forEach(category => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${category.category || category._id || 'N/A'}</td>
                    <td>${Number(category.totalSales || 0).toFixed(2)}$</td>
                    <td>${Number(category.profit || 0).toFixed(2)}$</td>
                `;
                categoryTableBody.appendChild(tr);
            });
        } else {
            categoryTableBody.innerHTML = 
                '<tr><td colspan="3" class="no-data">Aucune donnée disponible</td></tr>';
        }

        console.log('9. Chargement des statistiques des coupons');
        // Charger les statistiques des coupons
        const couponResponse = await fetch('/api/stats/coupons');
        if (!couponResponse.ok) {
            console.error('10. Erreur lors du chargement des coupons:', await couponResponse.text());
            throw new Error('Erreur lors du chargement des statistiques des coupons');
        }
        const couponData = await couponResponse.json();
        console.log('11. Données des coupons reçues:', couponData);
        displayCouponReports(couponData);

        console.log('12. Chargement terminé avec succès');

    } catch (error) {
        console.error('Erreur détaillée:', error);
        console.error('Stack trace:', error.stack);
        
        // Afficher les messages d'erreur
        document.getElementById('total-sales-value').textContent = '0.00$';
        document.getElementById('total-profit-value').textContent = '0.00$';
        document.getElementById('total-transactions-value').textContent = '0';

        const tables = {
            '#product-sales-table': 4,
            '#category-sales-table': 3,
            '#coupon-usage-table': 5,
            '#sales-with-coupons-table': 6
        };

        Object.entries(tables).forEach(([selector, cols]) => {
            document.querySelector(`${selector} tbody`).innerHTML = 
                `<tr><td colspan="${cols}" class="error">Erreur lors du chargement des données: ${error.message}</td></tr>`;
        });
    }
}

// Ajouter la fonction de filtrage des rapports
function filterReports() {
    loadReports();
}

// Ajouter les fonctions de gestion des coupons
let editingCouponId = null;

function openAddCouponModal() {
    editingCouponId = null;
    document.querySelector('#coupon-modal h2').textContent = 'Ajouter un coupon';
    document.getElementById('coupon-form').reset();
    
    // Définir la date de début à aujourd'hui par défaut
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('coupon-start').value = today;
    
    document.getElementById('coupon-modal').classList.add('show');
}

async function loadCoupons() {
    try {
        const response = await fetch('/api/coupons');
        const coupons = await response.json();
        
        const tbody = document.querySelector('#coupons-table tbody');
        tbody.innerHTML = '';
        
        coupons.forEach(coupon => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${coupon.code}</td>
                <td>${coupon.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}</td>
                <td>${coupon.value}${coupon.type === 'percentage' ? '%' : '$'}</td>
                <td>${new Date(coupon.startDate).toLocaleDateString()} - ${new Date(coupon.endDate).toLocaleDateString()}</td>
                <td>${coupon.usageCount}${coupon.usageLimit ? '/' + coupon.usageLimit : ''}</td>
                <td>
                    <span class="status-badge ${coupon.active ? 'active' : 'inactive'}">
                        ${coupon.active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td class="actions-cell">
                    <button onclick="editCoupon('${coupon._id}')" class="btn btn-edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCoupon('${coupon._id}')" class="btn btn-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des coupons:', error);
    }
}

async function editCoupon(couponId) {
    try {
        const response = await fetch(`/api/coupons/${couponId}`);
        const coupon = await response.json();
        
        editingCouponId = couponId;
        document.querySelector('#coupon-modal h2').textContent = 'Modifier le coupon';
        
        document.getElementById('coupon-code').value = coupon.code;
        document.getElementById('coupon-type').value = coupon.type;
        document.getElementById('coupon-value').value = coupon.value;
        document.getElementById('coupon-start').value = coupon.startDate.split('T')[0];
        document.getElementById('coupon-end').value = coupon.endDate.split('T')[0];
        document.getElementById('coupon-limit').value = coupon.usageLimit || '';
        document.getElementById('coupon-active').checked = coupon.active;
        
        document.getElementById('coupon-modal').classList.add('show');
    } catch (error) {
        console.error('Erreur lors du chargement du coupon:', error);
    }
}

async function deleteCoupon(couponId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce coupon ?')) {
        try {
            await fetch(`/api/coupons/${couponId}`, { method: 'DELETE' });
            loadCoupons();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    }
}

// Dans la fonction d'initialisation ou après le chargement du DOM
document.getElementById('coupon-application').addEventListener('change', function(e) {
    const productsSelection = document.getElementById('products-selection');
    const categoriesSelection = document.getElementById('categories-selection');
    
    productsSelection.style.display = 'none';
    categoriesSelection.style.display = 'none';
    
    if (e.target.value === 'product') {
        productsSelection.style.display = 'block';
        loadProductsForCoupon();
    } else if (e.target.value === 'category') {
        categoriesSelection.style.display = 'block';
        loadCategoriesForCoupon();
    }
});

async function loadProductsForCoupon() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        const productsList = document.querySelector('.products-list');
        productsList.innerHTML = products.map(product => `
            <div class="checkbox-group">
                <input type="checkbox" 
                       id="product-${product._id}" 
                       name="applicable-products" 
                       value="${product._id}">
                <label for="product-${product._id}">
                    ${product.name} (${product.category})
                </label>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
    }
}

async function loadCategoriesForCoupon() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const categoriesList = document.querySelector('.categories-list');
        categoriesList.innerHTML = categories.map(category => `
            <div class="checkbox-group">
                <input type="checkbox" 
                       id="category-${category._id}" 
                       name="applicable-categories" 
                       value="${category.name}">
                <label for="category-${category._id}">
                    ${category.name}
                </label>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
    }
}

// Modifier la soumission du formulaire de coupon
document.getElementById('coupon-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const applicationType = document.getElementById('coupon-application').value;
    let applicableProducts = [];
    let applicableCategories = [];

    if (applicationType === 'product') {
        applicableProducts = Array.from(
            document.querySelectorAll('input[name="applicable-products"]:checked')
        ).map(input => input.value);
    } else if (applicationType === 'category') {
        applicableCategories = Array.from(
            document.querySelectorAll('input[name="applicable-categories"]:checked')
        ).map(input => input.value);
    }

    const couponData = {
        code: document.getElementById('coupon-code').value.toUpperCase(),
        type: document.getElementById('coupon-type').value,
        value: parseFloat(document.getElementById('coupon-value').value),
        startDate: document.getElementById('coupon-start').value,
        endDate: document.getElementById('coupon-end').value,
        usageLimit: document.getElementById('coupon-limit').value || null,
        active: document.getElementById('coupon-active').checked,
        applicationType,
        applicableProducts,
        applicableCategories
    };

    try {
        const url = editingCouponId ? 
            `/api/coupons/${editingCouponId}` : '/api/coupons';
        const method = editingCouponId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(couponData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        document.getElementById('coupon-modal').classList.remove('show');
        loadCoupons();
    } catch (error) {
        console.error('Erreur lors de la sauvegarde:', error);
        alert(error.message || 'Erreur lors de la sauvegarde du coupon');
    }
};

function displayCouponReports(data) {
    try {
        // Afficher les statistiques d'utilisation des coupons
        const couponUsageBody = document.querySelector('#coupon-usage-table tbody');
        if (data.couponStats && data.couponStats.length > 0) {
            couponUsageBody.innerHTML = '';
            data.couponStats.forEach(stat => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${stat.couponInfo?.code || 'N/A'}</td>
                    <td>${stat.couponInfo?.type === 'percentage' ? 'Pourcentage' : 'Montant fixe'}</td>
                    <td>${stat.couponInfo?.value || 0}${stat.couponInfo?.type === 'percentage' ? '%' : '$'}</td>
                    <td>${stat.usageCount || 0}</td>
                    <td>${(stat.totalDiscount || 0).toFixed(2)}$</td>
                `;
                couponUsageBody.appendChild(tr);
            });
        } else {
            couponUsageBody.innerHTML = 
                '<tr><td colspan="5" class="no-data">Aucun coupon utilisé</td></tr>';
        }

        // Afficher les ventes avec coupons
        const salesWithCouponsBody = document.querySelector('#sales-with-coupons-table tbody');
        const validSales = data.salesWithCoupons?.filter(sale => sale.coupon && sale.coupon.code) || [];
        
        if (validSales.length > 0) {
            salesWithCouponsBody.innerHTML = '';
            validSales.forEach(sale => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(sale.date).toLocaleDateString()}</td>
                    <td>${sale.coupon.code}</td>
                    <td>${formatSaleItems(sale.items)}</td>
                    <td>${(sale.originalTotal || 0).toFixed(2)}$</td>
                    <td>${(sale.discount || 0).toFixed(2)}$</td>
                    <td>${(sale.total || 0).toFixed(2)}$</td>
                `;
                salesWithCouponsBody.appendChild(tr);
            });
        } else {
            salesWithCouponsBody.innerHTML = 
                '<tr><td colspan="6" class="no-data">Aucune vente avec coupon</td></tr>';
        }

        // Afficher les produits vendus avec coupons
        const productsWithCouponsBody = document.querySelector('#products-with-coupons-table tbody');
        if (data.productsWithCoupons?.length > 0) {
            productsWithCouponsBody.innerHTML = '';
            data.productsWithCoupons.forEach(product => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${product.productName}</td>
                    <td>${product.totalQuantity}</td>
                    <td>${product.couponCount}</td>
                    <td>${product.totalDiscount.toFixed(2)}$</td>
                    <td>${product.totalSales.toFixed(2)}$</td>
                `;
                productsWithCouponsBody.appendChild(tr);
            });
        } else {
            productsWithCouponsBody.innerHTML = 
                '<tr><td colspan="5" class="no-data">Aucun produit vendu avec coupon</td></tr>';
        }
    } catch (error) {
        console.error('Erreur lors de l\'affichage des rapports de coupons:', error);
        
        // Afficher les messages d'erreur
        document.querySelector('#coupon-usage-table tbody').innerHTML = 
            '<tr><td colspan="5" class="error">Erreur lors de l\'affichage des données</td></tr>';
        document.querySelector('#sales-with-coupons-table tbody').innerHTML = 
            '<tr><td colspan="6" class="error">Erreur lors de l\'affichage des données</td></tr>';
        document.querySelector('#products-with-coupons-table tbody').innerHTML = 
            '<tr><td colspan="5" class="error">Erreur lors de l\'affichage des données</td></tr>';
    }
}

// Ajouter la fonction de déconnexion
async function logout() {
    try {
        const response = await fetch('/auth/logout');
        if (response.ok) {
            // Rediriger vers la page de login
            window.location.href = '/login';
        } else {
            throw new Error('Erreur lors de la déconnexion');
        }
    } catch (error) {
        console.error('Erreur de déconnexion:', error);
        alert('Erreur lors de la déconnexion');
    }
}

// Ajouter au début du fichier, dans la vérification d'authentification
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        if (!response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        window.location.href = '/login';
    }
}

// Appeler la vérification au chargement
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    // ... reste du code existant
});

// Gestion des utilisateurs
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>
                    <span class="user-role ${user.role}">
                        ${user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${user.active ? 'active' : 'inactive'}">
                        ${user.active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Jamais'}</td>
                <td class="actions-cell">
                    <button onclick="editUser('${user._id}')" class="btn-edit" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="changePassword('${user._id}')" class="btn-edit password-btn" title="Changer le mot de passe">
                        <i class="fas fa-key"></i>
                    </button>
                    <button onclick="deleteUser('${user._id}')" class="btn-delete" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs:', error);
    }
}

let editingUserId = null;
let changingPasswordUserId = null;

function openAddUserModal() {
    editingUserId = null;
    document.querySelector('#user-modal h2').textContent = 'Ajouter un utilisateur';
    document.getElementById('user-form').reset();
    document.getElementById('user-modal').classList.add('show');
}

async function editUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        const user = await response.json();
        
        editingUserId = userId;
        document.querySelector('#user-modal h2').textContent = 'Modifier l\'utilisateur';
        
        document.getElementById('user-username').value = user.username;
        document.getElementById('user-role').value = user.role;
        document.getElementById('user-active').checked = user.active;
        document.getElementById('user-password').required = false;
        document.getElementById('user-password').placeholder = 'Laisser vide pour ne pas modifier';
        
        document.getElementById('user-modal').classList.add('show');
    } catch (error) {
        console.error('Erreur lors du chargement de l\'utilisateur:', error);
    }
}

function changePassword(userId) {
    changingPasswordUserId = userId;
    document.getElementById('password-modal').classList.add('show');
}

// Gérer la soumission du formulaire utilisateur
document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const userData = {
        username: document.getElementById('user-username').value,
        role: document.getElementById('user-role').value,
        active: document.getElementById('user-active').checked
    };
    
    const password = document.getElementById('user-password').value;
    if (password) {
        userData.password = password;
    }

    try {
        const url = editingUserId ? 
            `/api/users/${editingUserId}` : '/api/users';
        const method = editingUserId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la sauvegarde');
        }

        document.getElementById('user-modal').classList.remove('show');
        loadUsers();
    } catch (error) {
        console.error('Erreur:', error);
        alert(error.message);
    }
};

// Modifier la gestion du formulaire de changement de mot de passe
document.getElementById('password-form').onsubmit = async (e) => {
    e.preventDefault();
    
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorElement = document.getElementById('password-error');
    
    // Vérifier que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
        errorElement.textContent = 'Les mots de passe ne correspondent pas';
        errorElement.style.display = 'block';
        return;
    }
    
    // Vérifier la longueur minimale
    if (newPassword.length < 6) {
        errorElement.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
        errorElement.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch(`/api/users/${changingPasswordUserId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: newPassword
            })
        });

        if (!response.ok) {
            throw new Error('Erreur lors du changement de mot de passe');
        }

        document.getElementById('password-modal').classList.remove('show');
        document.getElementById('password-form').reset();
        errorElement.style.display = 'none';
        alert('Mot de passe modifié avec succès');
    } catch (error) {
        console.error('Erreur:', error);
        errorElement.textContent = error.message;
        errorElement.style.display = 'block';
    }
};

async function deleteUser(userId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la suppression');
            }

            loadUsers();
        } catch (error) {
            console.error('Erreur:', error);
            alert(error.message);
        }
    }
}

// Ajouter loadUsers à l'initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-tab="users"]')) {
        loadUsers();
    }
});