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
        } else if (tab.dataset.tab === 'smtp') {
            loadSMTPConfig();
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
                    <img src="${(product.imageUrl || product.image || '/images/default-product.png')}" alt="${product.name}" onerror="this.src='/images/default-product.png'">
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
            const totalSales = Number(data.overall.totalSales || 0);
            const totalProfit = Number(data.overall.totalProfit || 0);
            const totalTransactions = data.overall.count || 0;
            const averageCart = totalTransactions > 0 ? totalSales / totalTransactions : 0;
            
            document.getElementById('total-sales-value').textContent = 
                `${totalSales.toFixed(2)}$`;
            document.getElementById('total-profit-value').textContent = 
                `${totalProfit.toFixed(2)}$`;
            document.getElementById('total-transactions-value').textContent = 
                totalTransactions;
            document.getElementById('average-cart-value').textContent = 
                `${averageCart.toFixed(2)}$`;
            
            // Animer les valeurs
            animateValue('total-sales-value', 0, totalSales, 1000, '$');
            animateValue('total-profit-value', 0, totalProfit, 1000, '$');
            animateValue('total-transactions-value', 0, totalTransactions, 1000, '');
            animateValue('average-cart-value', 0, averageCart, 1000, '$');
        }

        // Afficher les ventes par produit
        console.log('7. Mise à jour des ventes par produit');
        const productTableBody = document.querySelector('#product-sales-table tbody');
        if (data.popularProducts && Array.isArray(data.popularProducts) && data.popularProducts.length > 0) {
            // Trouver la valeur maximale pour la barre de progression
            const maxSales = Math.max(...data.popularProducts.map(p => Number(p.totalSales || 0)));
            
            productTableBody.innerHTML = '';
            data.popularProducts.forEach((product, index) => {
                const sales = Number(product.totalSales || 0);
                const profit = Number(product.profit || 0);
                const percentage = maxSales > 0 ? (sales / maxSales * 100) : 0;
                const profitMargin = sales > 0 ? (profit / sales * 100) : 0;
                
                const tr = document.createElement('tr');
                tr.style.animationDelay = `${index * 0.05}s`;
                tr.className = 'fade-in';
                tr.innerHTML = `
                    <td>
                        <div class="product-cell">
                            <span class="product-rank">#${index + 1}</span>
                            <span class="product-name">${product.name || 'N/A'}</span>
                        </div>
                    </td>
                    <td><span class="badge quantity">${product.totalQuantity || 0}</span></td>
                    <td><strong>${sales.toFixed(2)}$</strong></td>
                    <td>
                        <span class="profit-amount ${profit >= 0 ? 'positive' : 'negative'}">
                            ${profit.toFixed(2)}$
                        </span>
                    </td>
                    <td>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${percentage}%"></div>
                            <span class="progress-text">${percentage.toFixed(0)}%</span>
                        </div>
                    </td>
                `;
                productTableBody.appendChild(tr);
            });
        } else {
            productTableBody.innerHTML = 
                '<tr><td colspan="5" class="no-data"><i class="fas fa-inbox"></i> Aucune donnée disponible</td></tr>';
        }

        // Afficher les ventes par catégorie
        console.log('8. Mise à jour des ventes par catégorie');
        const categoryTableBody = document.querySelector('#category-sales-table tbody');
        const categoryChartContainer = document.getElementById('category-chart-container');
        
        if (data.categoryStats && Array.isArray(data.categoryStats) && data.categoryStats.length > 0) {
            // Calculer le total pour les pourcentages
            const totalCategorySales = data.categoryStats.reduce((sum, cat) => 
                sum + Number(cat.totalSales || 0), 0);
            
            // Créer le graphique visuel
            if (categoryChartContainer) {
                categoryChartContainer.innerHTML = '';
                const chartDiv = document.createElement('div');
                chartDiv.className = 'category-chart';
                
                data.categoryStats.forEach((category, index) => {
                    const sales = Number(category.totalSales || 0);
                    const percentage = totalCategorySales > 0 ? (sales / totalCategorySales * 100) : 0;
                    const categoryName = category.category || category._id || 'N/A';
                    
                    const barDiv = document.createElement('div');
                    barDiv.className = 'chart-bar-item';
                    barDiv.innerHTML = `
                        <div class="chart-bar-label">
                            <span>${categoryName}</span>
                            <span class="chart-bar-value">${sales.toFixed(2)}$</span>
                        </div>
                        <div class="chart-bar-wrapper">
                            <div class="chart-bar" style="width: ${percentage}%" data-percentage="${percentage.toFixed(1)}%"></div>
                        </div>
                    `;
                    chartDiv.appendChild(barDiv);
                });
                
                categoryChartContainer.appendChild(chartDiv);
            }
            
            // Remplir le tableau
            categoryTableBody.innerHTML = '';
            data.categoryStats.forEach((category, index) => {
                const sales = Number(category.totalSales || 0);
                const profit = Number(category.profit || 0);
                const percentage = totalCategorySales > 0 ? (sales / totalCategorySales * 100) : 0;
                
                const tr = document.createElement('tr');
                tr.style.animationDelay = `${index * 0.05}s`;
                tr.className = 'fade-in';
                tr.innerHTML = `
                    <td>
                        <div class="category-cell">
                            <span class="category-icon"><i class="fas fa-tag"></i></span>
                            <span>${category.category || category._id || 'N/A'}</span>
                        </div>
                    </td>
                    <td><strong>${sales.toFixed(2)}$</strong></td>
                    <td>
                        <span class="profit-amount ${profit >= 0 ? 'positive' : 'negative'}">
                            ${profit.toFixed(2)}$
                        </span>
                    </td>
                    <td>
                        <div class="percentage-badge">
                            ${percentage.toFixed(1)}%
                        </div>
                    </td>
                `;
                categoryTableBody.appendChild(tr);
            });
        } else {
            if (categoryChartContainer) {
                categoryChartContainer.innerHTML = '<div class="no-data"><i class="fas fa-inbox"></i> Aucune donnée disponible</div>';
            }
            categoryTableBody.innerHTML = 
                '<tr><td colspan="4" class="no-data"><i class="fas fa-inbox"></i> Aucune donnée disponible</td></tr>';
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
            '#product-sales-table': 5,
            '#category-sales-table': 4,
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

// Réinitialiser les filtres
function resetReportsFilter() {
    document.getElementById('report-start-date').value = '';
    document.getElementById('report-end-date').value = '';
    loadReports();
}

// Fonction pour animer les valeurs
function animateValue(id, start, end, duration, suffix = '') {
    const element = document.getElementById(id);
    if (!element) return;
    
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        
        if (suffix === '$') {
            element.textContent = `${current.toFixed(2)}${suffix}`;
        } else if (suffix === '') {
            element.textContent = Math.round(current);
        } else {
            element.textContent = `${current.toFixed(2)}${suffix}`;
        }
    }, 16);
}

// Fonction pour exporter les ventes par produit
function exportProductSales() {
    // TODO: Implémenter l'export
    alert('Fonction d\'export à implémenter');
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
        const response = await fetch('/auth/logout', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                window.location.href = '/login';
            } else {
                // En cas d'erreur, forcer la redirection
                window.location.href = '/login';
            }
        } else {
            // En cas d'erreur HTTP, forcer la redirection
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Erreur de déconnexion:', error);
        // Forcer la redirection même en cas d'erreur
        window.location.href = '/login';
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
                        ${user.role === 'admin' ? 'Administrateur' : user.role === 'ticket_seller' ? 'Vendeur de tickets' : 'Utilisateur'}
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

// ============================================
// FONCTIONS D'EXPORT/IMPORT
// ============================================

// Exporter les données
async function exportData() {
    try {
        // Vérifier qu'au moins une option est sélectionnée
        const exportProducts = document.getElementById('export-products').checked;
        const exportCategories = document.getElementById('export-categories').checked;
        const exportCoupons = document.getElementById('export-coupons').checked;
        const exportUsers = document.getElementById('export-users').checked;
        const exportSales = document.getElementById('export-sales').checked;
        
        if (!exportProducts && !exportCategories && !exportCoupons && !exportUsers && !exportSales) {
            alert('Veuillez sélectionner au moins une option à exporter.');
            return;
        }
        
        // Construire l'URL avec les paramètres
        const params = new URLSearchParams({
            products: exportProducts,
            categories: exportCategories,
            coupons: exportCoupons,
            users: exportUsers,
            sales: exportSales
        });
        
        const url = `/api/export?${params.toString()}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Erreur lors de l\'export');
        }
        
        // Détecter le type de fichier depuis le Content-Type
        const contentType = response.headers.get('content-type') || '';
        const isZip = contentType.includes('application/zip') || contentType.includes('application/x-zip-compressed');
        
        // Récupérer le nom de fichier depuis Content-Disposition si disponible
        const contentDisposition = response.headers.get('content-disposition') || '';
        let filename = null;
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        // Si pas de nom de fichier dans les headers, en créer un
        if (!filename) {
            const selectedOptions = [];
            if (exportProducts) selectedOptions.push('produits');
            if (exportCategories) selectedOptions.push('categories');
            if (exportCoupons) selectedOptions.push('coupons');
            if (exportUsers) selectedOptions.push('users');
            if (exportSales) selectedOptions.push('ventes');
            
            const extension = isZip ? 'zip' : 'json';
            filename = `cantine-export-${selectedOptions.join('-')}-${new Date().toISOString().split('T')[0]}.${extension}`;
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
        
        alert('Export réussi ! Le fichier a été téléchargé.');
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        alert('Erreur lors de l\'export : ' + error.message);
    }
}

// Gérer la sélection de fichier
document.addEventListener('DOMContentLoaded', () => {
    const importFile = document.getElementById('import-file');
    const importBtn = document.getElementById('import-btn');
    const fileName = document.getElementById('selected-file-name');
    
    if (importFile) {
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileName.textContent = `Fichier sélectionné : ${file.name}`;
                importBtn.disabled = false;
            } else {
                fileName.textContent = '';
                importBtn.disabled = true;
            }
        });
    }
});

// Importer les données
async function importData() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Veuillez sélectionner un fichier');
        return;
    }
    
    if (!confirm('Êtes-vous sûr de vouloir importer ces données ? Cette action peut modifier vos données existantes.')) {
        return;
    }
    
    try {
        const options = {
            importProducts: document.getElementById('import-products').checked,
            importCategories: document.getElementById('import-categories').checked,
            importCoupons: document.getElementById('import-coupons').checked,
            importUsers: document.getElementById('import-users').checked,
            importSales: document.getElementById('import-sales').checked,
            overwrite: document.getElementById('import-overwrite').checked
        };
        
        // Vérifier si c'est un fichier ZIP ou JSON
        const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('options', JSON.stringify(options));
        
        const response = await fetch('/api/import', {
            method: 'POST',
            body: formData
            // Ne pas définir Content-Type - le navigateur le fera automatiquement avec la boundary
        });
        
        // Lire la réponse comme texte d'abord pour déboguer
        const responseText = await response.text();
        
        // Vérifier le type de contenu
        const contentType = response.headers.get('content-type');
        console.log('Content-Type de la réponse:', contentType);
        console.log('Premiers caractères de la réponse:', responseText.substring(0, 100));
        
        // Si ce n'est pas JSON, c'est une erreur
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Erreur serveur (${response.status}): ${responseText.substring(0, 200)}`);
        }
        
        // Parser comme JSON
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Erreur de parsing JSON:', parseError);
            console.error('Réponse complète:', responseText);
            throw new Error(`Erreur de parsing JSON: ${parseError.message}. Réponse: ${responseText.substring(0, 200)}`);
        }
        
        if (!response.ok) {
            throw new Error(result.message || 'Erreur lors de l\'import');
        }
        
        // Afficher les résultats
        displayImportResults(result);
        
        // Recharger les données si nécessaire
        if (options.importProducts) {
            loadInventory();
        }
        if (options.importCategories) {
            // Recharger les catégories si nécessaire
        }
        if (options.importCoupons) {
            loadCoupons();
        }
        if (options.importUsers) {
            loadUsers();
        }
        
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        alert('Erreur lors de l\'import : ' + error.message);
    }
}

// Afficher les résultats de l'import
function displayImportResults(result) {
    const resultsDiv = document.getElementById('import-results');
    resultsDiv.style.display = 'block';
    resultsDiv.className = 'import-results success';
    
    let html = '<h4>Import terminé avec succès</h4>';
    html += '<table>';
    html += '<tr><th>Type</th><th>Importés</th><th>Erreurs</th></tr>';
    
    const types = ['products', 'categories', 'coupons', 'users', 'sales', 'images'];
    types.forEach(type => {
        if (result.results[type]) {
            const r = result.results[type];
            const label = type === 'images' ? 'Images' : type.charAt(0).toUpperCase() + type.slice(1);
            const count = type === 'images' ? (r.copied || 0) : r.imported;
            html += `<tr>
                <td>${label}</td>
                <td>${count}</td>
                <td>${r.errors ? r.errors.length : 0}</td>
            </tr>`;
        }
    });
    
    html += '</table>';
    
    // Afficher les erreurs s'il y en a
    let hasErrors = false;
    types.forEach(type => {
        if (result.results[type] && result.results[type].errors.length > 0) {
            hasErrors = true;
        }
    });
    
    if (hasErrors) {
        html += '<h4 style="margin-top: 15px;">Erreurs rencontrées :</h4>';
        types.forEach(type => {
            if (result.results[type] && result.results[type].errors.length > 0) {
                html += `<p><strong>${type}:</strong></p><ul>`;
                result.results[type].errors.forEach(err => {
                    html += `<li>${err.name || err.code || 'Inconnu'}: ${err.error}</li>`;
                });
                html += '</ul>';
            }
        });
        resultsDiv.className = 'import-results error';
    }
    
    resultsDiv.innerHTML = html;
    
    // Scroll vers les résultats
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Ajouter loadUsers à l'initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-tab="users"]')) {
        loadUsers();
    }
    
    if (document.querySelector('[data-tab="tickets"]')) {
        loadTicketsStats();
        loadTickets();
        loadTicketConfig();
        loadSellerReport();
    }
    
    if (document.querySelector('[data-tab="smtp"]')) {
        loadSMTPConfig();
    }
});

// ============================================
// FONCTIONS POUR LA GESTION DES TICKETS
// ============================================

let currentTicketsPage = 1;
let ticketsFilters = {};

// Charger les statistiques des tickets
async function loadTicketsStats() {
    try {
        const response = await fetch('/api/tickets/stats');
        if (!response.ok) throw new Error('Erreur lors du chargement des statistiques');
        
        const stats = await response.json();
        
        document.getElementById('total-tickets').textContent = stats.totalTickets || 0;
        document.getElementById('total-amount-stats').textContent = (stats.totalAmount || 0).toFixed(2) + '$';
        document.getElementById('total-winners').textContent = stats.totalWinners || 0;
        document.getElementById('eligible-tickets').textContent = (stats.totalTickets - stats.totalWinners) || 0;
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// Charger la liste des tickets
async function loadTickets(page = 1) {
    try {
        const email = document.getElementById('filter-email')?.value || '';
        const isWinner = document.getElementById('filter-winner')?.value || '';
        const status = document.getElementById('filter-status')?.value || '';
        
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '50'
        });
        
        if (email) params.append('email', email);
        if (isWinner) params.append('isWinner', isWinner);
        if (status) params.append('status', status);
        
        const response = await fetch(`/api/tickets?${params.toString()}`);
        if (!response.ok) throw new Error('Erreur lors du chargement des tickets');
        
        const data = await response.json();
        currentTicketsPage = page;
        
        // Afficher les tickets
        const tbody = document.querySelector('#tickets-table tbody');
        tbody.innerHTML = '';
        
        if (data.tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Aucun ticket trouvé</td></tr>';
        } else {
            data.tickets.forEach(ticket => {
                const row = document.createElement('tr');
                row.className = ticket.isWinner ? 'winner-row' : '';
                const statusBadge = ticket.status === 'cancelled' 
                    ? '<span class="badge cancelled-badge"><i class="fas fa-times-circle"></i> Annulé</span>'
                    : ticket.isWinner 
                        ? '<span class="badge winner-badge"><i class="fas fa-trophy"></i> Gagnant</span>' 
                        : '<span class="badge active-badge"><i class="fas fa-check-circle"></i> Actif</span>';
                
                const actions = ticket.status === 'cancelled'
                    ? '<span style="color: #999; font-size: 0.9rem;">Annulé</span>'
                    : ticket.isWinner 
                        ? `<button onclick="resetWinner('${ticket._id}')" class="btn-small btn-secondary">
                            <i class="fas fa-undo"></i> Réinitialiser
                           </button>`
                        : `<button onclick="cancelTicket('${ticket._id}', '${ticket.ticketNumber}')" class="btn-small btn-danger">
                            <i class="fas fa-ban"></i> Annuler
                           </button>`;
                
                row.innerHTML = `
                    <td><strong>${ticket.ticketNumber}</strong></td>
                    <td>${ticket.email}</td>
                    <td>${new Date(ticket.purchaseDate).toLocaleDateString('fr-FR')}</td>
                    <td>${ticket.totalAmount.toFixed(2)}$</td>
                    <td>${statusBadge}</td>
                    <td>${actions}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // Afficher la pagination
        displayTicketsPagination(data.totalPages, page);
        
        // Recharger les stats
        loadTicketsStats();
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des tickets');
    }
}

// Afficher la pagination
function displayTicketsPagination(totalPages, currentPage) {
    const paginationDiv = document.getElementById('tickets-pagination');
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-controls">';
    
    if (currentPage > 1) {
        html += `<button onclick="loadTickets(${currentPage - 1})" class="page-btn">
            <i class="fas fa-chevron-left"></i> Précédent
        </button>`;
    }
    
    html += `<span>Page ${currentPage} sur ${totalPages}</span>`;
    
    if (currentPage < totalPages) {
        html += `<button onclick="loadTickets(${currentPage + 1})" class="page-btn">
            Suivant <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    html += '</div>';
    paginationDiv.innerHTML = html;
}

// Tirer un gagnant
async function drawWinner() {
    if (!confirm('Êtes-vous sûr de vouloir effectuer un tirage au sort ? Un gagnant sera sélectionné aléatoirement.')) {
        return;
    }
    
    const drawBtn = document.getElementById('draw-btn');
    const resultDiv = document.getElementById('draw-result');
    
    drawBtn.disabled = true;
    drawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Tirage en cours...';
    
    try {
        const response = await fetch('/api/tickets/draw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ excludeWinners: true })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.style.display = 'block';
            resultDiv.className = 'draw-result success';
            resultDiv.innerHTML = `
                <h3><i class="fas fa-trophy"></i> Gagnant sélectionné !</h3>
                <div class="winner-info">
                    <p><strong>Numéro gagnant:</strong> <span class="ticket-number">${data.winner.ticketNumber}</span></p>
                    <p><strong>Email:</strong> ${data.winner.email}</p>
                    <p><strong>Date d'achat:</strong> ${new Date(data.winner.purchaseDate).toLocaleDateString('fr-FR')}</p>
                    <p class="success-note">Un email a été envoyé au gagnant.</p>
                </div>
            `;
            
            // Recharger la liste
            loadTickets(currentTicketsPage);
        } else {
            resultDiv.style.display = 'block';
            resultDiv.className = 'draw-result error';
            resultDiv.innerHTML = `<p><i class="fas fa-exclamation-triangle"></i> ${data.message || 'Erreur lors du tirage'}</p>`;
        }
    } catch (error) {
        console.error('Erreur:', error);
        resultDiv.style.display = 'block';
        resultDiv.className = 'draw-result error';
        resultDiv.innerHTML = '<p><i class="fas fa-exclamation-triangle"></i> Erreur lors du tirage au sort</p>';
    } finally {
        drawBtn.disabled = false;
        drawBtn.innerHTML = '<i class="fas fa-magic"></i> <span>Tirer un gagnant</span>';
    }
}

// Réinitialiser tous les billets (supprimer tous les billets)
async function resetAllTickets() {
    // Double confirmation
    const confirm1 = prompt('ATTENTION : Cette action supprimera TOUS les billets de manière permanente.\n\nPour confirmer, tapez "SUPPRIMER TOUS" (en majuscules):');
    
    if (confirm1 !== 'SUPPRIMER TOUS') {
        alert('Action annulée. La confirmation ne correspond pas.');
        return;
    }
    
    if (!confirm('Êtes-vous ABSOLUMENT SÛR de vouloir supprimer TOUS les billets ?\n\nCette action est IRRÉVERSIBLE et supprimera tous les billets, y compris les gagnants.')) {
        return;
    }
    
    const resetBtn = document.getElementById('reset-all-btn');
    const originalText = resetBtn.innerHTML;
    
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Suppression en cours...';
    
    try {
        const response = await fetch('/api/tickets/all', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ confirm: 'DELETE_ALL_TICKETS' })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(`Tous les billets ont été supprimés avec succès.\n\n${data.deletedCount} billet(s) supprimé(s).`);
            // Recharger les données
            loadTickets(1);
            loadTicketsStats();
            loadTicketLogs();
        } else {
            alert(data.message || 'Erreur lors de la suppression des billets');
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la suppression des billets');
    } finally {
        resetBtn.disabled = false;
        resetBtn.innerHTML = originalText;
    }
}

// Réinitialiser un gagnant
async function resetWinner(ticketId) {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser ce gagnant ?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tickets/${ticketId}/reset-winner`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            loadTickets(currentTicketsPage);
            loadTicketsStats();
        } else {
            const data = await response.json();
            alert(data.message || 'Erreur lors de la réinitialisation');
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la réinitialisation');
    }
}

// Annuler un billet
async function cancelTicket(ticketId, ticketNumber) {
    let reason = '';
    
    // Demander la raison jusqu'à ce qu'elle soit fournie
    while (!reason || reason.trim() === '') {
        reason = prompt(`Voulez-vous annuler le billet ${ticketNumber} ?\n\nRaison de l'annulation (obligatoire):`);
        
        if (reason === null) {
            return; // L'utilisateur a annulé
        }
        
        if (!reason || reason.trim() === '') {
            alert('La raison de l\'annulation est obligatoire. Veuillez entrer une raison.');
        }
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir annuler le billet ${ticketNumber} ?\n\nRaison: ${reason}\n\nCette action sera enregistrée dans les logs.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/tickets/${ticketId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason.trim() })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Billet annulé avec succès. L\'action a été enregistrée dans les logs.');
            loadTickets(currentTicketsPage);
            loadTicketsStats();
            loadTicketLogs(); // Recharger les logs
        } else {
            alert(data.message || 'Erreur lors de l\'annulation du billet');
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de l\'annulation du billet');
    }
}

// Charger les logs d'annulation
let currentLogsPage = 1;

// Charger le rapport des vendeurs
async function loadSellerReport() {
    try {
        const startDate = document.getElementById('seller-report-start-date')?.value || '';
        const endDate = document.getElementById('seller-report-end-date')?.value || '';
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const response = await fetch(`/api/tickets/seller-report?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Erreur lors du chargement du rapport');
        }
        
        const data = await response.json();
        
        // Afficher les totaux
        const summaryDiv = document.getElementById('seller-report-summary');
        if (summaryDiv) {
            summaryDiv.style.display = 'flex';
            document.getElementById('seller-total-tickets').textContent = data.totals.totalTickets || 0;
            document.getElementById('seller-total-amount').textContent = (data.totals.totalAmount || 0).toFixed(2) + '$';
        }
        
        // Afficher le tableau
        const tbody = document.querySelector('#seller-report-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (data.sellers && data.sellers.length > 0) {
            data.sellers.forEach(seller => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${seller.sellerName || 'Non assigné'}</strong></td>
                    <td>${seller.sellerEmail || '-'}</td>
                    <td>${seller.totalTickets || 0}</td>
                    <td><strong>${(seller.totalAmount || 0).toFixed(2)}$</strong></td>
                    <td>${seller.totalQuantity || 0}</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" style="text-align: center; padding: 20px; color: #999;">Aucune vente enregistrée</td>';
            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error('Erreur lors du chargement du rapport des vendeurs:', error);
        const tbody = document.querySelector('#seller-report-table tbody');
        if (tbody) {
            tbody.innerHTML = '<td colspan="5" style="text-align: center; padding: 20px; color: #dc2626;">Erreur lors du chargement des données</td>';
        }
    }
}

async function loadTicketLogs(page = 1) {
    try {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '50',
            action: 'cancelled'
        });
        
        const response = await fetch(`/api/tickets/logs?${params.toString()}`);
        if (!response.ok) throw new Error('Erreur lors du chargement des logs');
        
        const data = await response.json();
        currentLogsPage = page;
        
        // Afficher les logs
        const tbody = document.querySelector('#tickets-logs-table tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (data.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Aucun log d\'annulation trouvé</td></tr>';
        } else {
            data.logs.forEach(log => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${log.ticketNumber}</strong></td>
                    <td>${log.email}</td>
                    <td>${new Date(log.originalPurchaseDate).toLocaleDateString('fr-FR')}</td>
                    <td>${log.totalAmount.toFixed(2)}$</td>
                    <td>${log.cancelledBy ? log.cancelledBy.username : 'N/A'}</td>
                    <td>${new Date(log.cancelledAt).toLocaleString('fr-FR')}</td>
                    <td>${log.reason || 'Aucune raison spécifiée'}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        // Afficher la pagination
        displayTicketLogsPagination(data.totalPages, page);
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des logs');
    }
}

// Afficher la pagination des logs
function displayTicketLogsPagination(totalPages, currentPage) {
    const paginationDiv = document.getElementById('tickets-logs-pagination');
    if (!paginationDiv) return;
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-controls">';
    
    if (currentPage > 1) {
        html += `<button onclick="loadTicketLogs(${currentPage - 1})" class="page-btn">
            <i class="fas fa-chevron-left"></i> Précédent
        </button>`;
    }
    
    html += `<span>Page ${currentPage} sur ${totalPages}</span>`;
    
    if (currentPage < totalPages) {
        html += `<button onclick="loadTicketLogs(${currentPage + 1})" class="page-btn">
            Suivant <i class="fas fa-chevron-right"></i>
        </button>`;
    }
    
    html += '</div>';
    paginationDiv.innerHTML = html;
}

// ============================================
// FONCTIONS POUR LA CONFIGURATION DES TICKETS
// ============================================

let quantityOffersCount = 0;

// Charger la configuration des tickets
async function loadTicketConfig() {
    try {
        const response = await fetch('/api/tickets/config/admin');
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        const config = await response.json();
        
        // Remplir le formulaire
        document.getElementById('ticket-base-price').value = config.basePrice || 0.50;
        
        // Afficher les offres
        const offersList = document.getElementById('quantity-offers-list');
        offersList.innerHTML = '';
        quantityOffersCount = 0;
        
        if (config.quantityOffers && config.quantityOffers.length > 0) {
            config.quantityOffers.forEach(offer => {
                addQuantityOffer(offer.quantity, offer.price);
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement de la configuration');
    }
}

// Ajouter une offre de quantité
function addQuantityOffer(quantity = '', price = '') {
    const offersList = document.getElementById('quantity-offers-list');
    const offerId = quantityOffersCount++;
    
    const offerDiv = document.createElement('div');
    offerDiv.className = 'quantity-offer-item';
    offerDiv.id = `offer-${offerId}`;
    offerDiv.innerHTML = `
        <div class="offer-inputs">
            <div class="offer-input-group">
                <label>Quantité minimale</label>
                <input type="number" class="offer-quantity" value="${quantity}" min="1" required placeholder="Ex: 3">
            </div>
            <div class="offer-input-group">
                <label>Prix total</label>
                <input type="number" class="offer-price" value="${price}" step="0.01" min="0" required placeholder="Ex: 10.00">
            </div>
            <button type="button" class="btn-remove-offer" onclick="removeQuantityOffer(${offerId})">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    offersList.appendChild(offerDiv);
}

// Supprimer une offre
function removeQuantityOffer(offerId) {
    const offerDiv = document.getElementById(`offer-${offerId}`);
    if (offerDiv) {
        offerDiv.remove();
    }
}

// Sauvegarder la configuration
document.addEventListener('DOMContentLoaded', () => {
    const configForm = document.getElementById('ticket-config-form');
    if (configForm) {
        configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const basePrice = parseFloat(document.getElementById('ticket-base-price').value);
            const offerItems = document.querySelectorAll('.quantity-offer-item');
            
            const quantityOffers = [];
            offerItems.forEach(item => {
                const quantity = parseInt(item.querySelector('.offer-quantity').value);
                const price = parseFloat(item.querySelector('.offer-price').value);
                
                if (quantity && price >= 0) {
                    quantityOffers.push({ quantity, price });
                }
            });
            
            try {
                const response = await fetch('/api/tickets/config', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        basePrice,
                        quantityOffers
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('Configuration sauvegardée avec succès !');
                    loadTicketConfig(); // Recharger pour afficher les données sauvegardées
                } else {
                    alert(data.message || 'Erreur lors de la sauvegarde');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la sauvegarde de la configuration');
            }
        });
    }
});

// ============================================
// FONCTIONS POUR LA CONFIGURATION SMTP
// ============================================

// Charger la configuration SMTP
async function loadSMTPConfig() {
    try {
        const response = await fetch('/api/smtp/config');
        if (!response.ok) throw new Error('Erreur lors du chargement');
        
        const config = await response.json();
        
        // Remplir le formulaire
        document.getElementById('smtp-host').value = config.host || 'smtp.gmail.com';
        document.getElementById('smtp-port').value = config.port || 587;
        document.getElementById('smtp-secure').value = config.secure ? 'true' : 'false';
        document.getElementById('smtp-user').value = config.user || '';
        document.getElementById('smtp-from').value = config.from || '';
        document.getElementById('smtp-from-name').value = config.fromName || 'Cantine';
        
        // Afficher un message si un mot de passe existe déjà
        const passwordInfo = document.getElementById('smtp-password-info');
        if (config.hasPassword && passwordInfo) {
            passwordInfo.textContent = 'Un mot de passe est déjà configuré. Laissez vide pour le conserver.';
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement de la configuration SMTP');
    }
}

// Sauvegarder la configuration SMTP
document.addEventListener('DOMContentLoaded', () => {
    const smtpForm = document.getElementById('smtp-config-form');
    if (smtpForm) {
        smtpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const host = document.getElementById('smtp-host').value.trim();
            const port = parseInt(document.getElementById('smtp-port').value);
            const secure = document.getElementById('smtp-secure').value === 'true';
            const user = document.getElementById('smtp-user').value.trim();
            const password = document.getElementById('smtp-password').value;
            const from = document.getElementById('smtp-from').value.trim();
            const fromName = document.getElementById('smtp-from-name').value.trim();
            
            try {
                const response = await fetch('/api/smtp/config', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        host,
                        port,
                        secure,
                        user,
                        password: password || undefined, // Ne pas envoyer si vide
                        from,
                        fromName: fromName || 'Cantine'
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('Configuration SMTP sauvegardée avec succès !\n' + data.message);
                    loadSMTPConfig(); // Recharger pour afficher les données sauvegardées
                } else {
                    alert(data.message || 'Erreur lors de la sauvegarde');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur lors de la sauvegarde de la configuration SMTP');
            }
        });
    }
});

// Tester la configuration SMTP (fonction globale)
window.testSMTPConfig = function() {
    const testSection = document.getElementById('smtp-test-section');
    if (testSection) {
        testSection.style.display = testSection.style.display === 'none' ? 'block' : 'none';
    }
}

// Envoyer un email de test (fonction globale)
window.sendTestEmail = async function() {
    const testEmail = document.getElementById('test-email').value.trim();
    const testResult = document.getElementById('smtp-test-result');
    
    if (!testEmail || !testEmail.includes('@')) {
        testResult.className = 'test-result error';
        testResult.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Veuillez entrer une adresse email valide';
        return;
    }
    
    testResult.className = 'test-result';
    testResult.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
    
    try {
        const response = await fetch('/api/smtp/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ testEmail })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            testResult.className = 'test-result success';
            testResult.innerHTML = `<i class="fas fa-check-circle"></i> ${data.message}`;
        } else {
            testResult.className = 'test-result error';
            testResult.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${data.message || 'Erreur lors de l\'envoi'}`;
        }
    } catch (error) {
        console.error('Erreur:', error);
        testResult.className = 'test-result error';
        testResult.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erreur lors de l\'envoi de l\'email de test';
    }
}