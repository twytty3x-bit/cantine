let ticketConfig = { basePrice: 0.50, quantityOffers: [] };

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    await loadTicketConfig();
    await loadStats();
    setupTicketSaleModal();
});

// Charger la configuration des tickets
async function loadTicketConfig() {
    try {
        const response = await fetch('/api/tickets/config', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erreur HTTP:', response.status, errorText);
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Réponse non-JSON reçue:', text.substring(0, 200));
            throw new Error('Réponse non-JSON reçue');
        }
        
        ticketConfig = await response.json();
        console.log('Configuration chargée:', ticketConfig);
        displayAvailableOffers();
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration des tickets:', error);
        // Afficher une configuration par défaut en cas d'erreur
        ticketConfig = { basePrice: 0.50, quantityOffers: [] };
        displayAvailableOffers();
    }
}

// Afficher les offres disponibles comme boutons sélectionnables
function displayAvailableOffers() {
    const offersSelection = document.getElementById('offers-selection');
    if (!offersSelection) return;
    
    offersSelection.innerHTML = '';
    
    // Si aucune offre n'est configurée, utiliser le prix de base
    if (!ticketConfig.quantityOffers || ticketConfig.quantityOffers.length === 0) {
        const basePrice = ticketConfig.basePrice || 0.50;
        const baseOffer = document.createElement('button');
        baseOffer.type = 'button';
        baseOffer.className = 'offer-button';
        baseOffer.dataset.quantity = '1';
        baseOffer.dataset.price = basePrice;
        baseOffer.innerHTML = `
            <div class="offer-button-content">
                <div class="offer-quantity">1 billet</div>
                <div class="offer-price">${basePrice.toFixed(2)}$</div>
            </div>
        `;
        baseOffer.onclick = () => selectOffer(1, basePrice, baseOffer);
        offersSelection.appendChild(baseOffer);
        return;
    }
    
    // Trier les offres par quantité croissante
    const sortedOffers = [...ticketConfig.quantityOffers].sort((a, b) => a.quantity - b.quantity);
    
    sortedOffers.forEach(offer => {
        const offerButton = document.createElement('button');
        offerButton.type = 'button';
        offerButton.className = 'offer-button';
        offerButton.dataset.quantity = offer.quantity;
        offerButton.dataset.price = offer.price;
        offerButton.innerHTML = `
            <div class="offer-button-content">
                <div class="offer-quantity">${offer.quantity} billet(s)</div>
                <div class="offer-price">${offer.price.toFixed(2)}$</div>
                ${offer.quantity > 1 && ticketConfig.basePrice ? `<div class="offer-savings">${((ticketConfig.basePrice * offer.quantity - offer.price) / (ticketConfig.basePrice * offer.quantity) * 100).toFixed(0)}% d'économie</div>` : ''}
            </div>
        `;
        offerButton.onclick = () => selectOffer(offer.quantity, offer.price, offerButton);
        offersSelection.appendChild(offerButton);
    });
}

// Sélectionner une offre
function selectOffer(quantity, price, buttonElement) {
    // Retirer la sélection de tous les boutons
    document.querySelectorAll('.offer-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Sélectionner le bouton cliqué
    buttonElement.classList.add('selected');
    
    // Mettre à jour les champs cachés
    const quantityInput = document.getElementById('ticket-quantity');
    const priceInput = document.getElementById('ticket-price');
    
    if (quantityInput && priceInput) {
        quantityInput.value = quantity;
        priceInput.value = price;
        
        // Mettre à jour l'affichage du total
        const totalDisplay = document.getElementById('ticket-total');
        if (totalDisplay) {
            totalDisplay.textContent = price.toFixed(2) + '$';
        }
        
        // Activer le bouton "Vendre les tickets"
        const addButton = document.getElementById('add-tickets-btn');
        if (addButton) {
            addButton.disabled = false;
        }
    }
}

// Gérer le modal de vente de tickets
function setupTicketSaleModal() {
    const modal = document.getElementById('ticket-sale-modal');
    const form = document.getElementById('ticket-sale-form');
    const closeBtn = modal?.querySelector('.close');
    
    // Gérer la soumission du formulaire
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const emailInput = document.getElementById('ticket-email');
            const quantityInput = document.getElementById('ticket-quantity');
            const priceInput = document.getElementById('ticket-price');
            
            if (!emailInput || !quantityInput || !priceInput) {
                alert('Erreur: champs du formulaire non trouvés');
                return;
            }
            
            const email = emailInput.value.trim();
            const quantity = parseInt(quantityInput.value);
            const price = parseFloat(priceInput.value);
            
            if (!email || !email.includes('@')) {
                alert('Veuillez entrer une adresse email valide');
                return;
            }
            
            if (!quantity || quantity < 1 || isNaN(quantity)) {
                alert('Veuillez sélectionner une offre');
                return;
            }
            
            if (!price || price <= 0 || isNaN(price)) {
                alert('Prix invalide. Veuillez sélectionner une offre.');
                return;
            }
            
            // Désactiver le bouton
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';
            
            try {
                const response = await fetch('/api/tickets/purchase', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email,
                        quantity,
                        totalAmount: price,
                        paymentMethod: 'cash'
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Afficher la notification de succès stylisée (comme dans le POS)
                    showSuccessNotification(quantity, email, data.tickets || []);
                    
                    form.reset();
                    document.getElementById('ticket-total').textContent = '0.00$';
                    document.getElementById('add-tickets-btn').disabled = true;
                    document.querySelectorAll('.offer-button').forEach(btn => {
                        btn.classList.remove('selected');
                    });
                    closeTicketSaleModal();
                    loadStats(); // Recharger les statistiques
                } else {
                    showErrorNotification(data.message || 'Erreur lors de la vente');
                }
            } catch (error) {
                console.error('Erreur:', error);
                showErrorNotification('Erreur de connexion. Veuillez réessayer.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Vendre les tickets';
            }
        });
    }
    
    // Fermer le modal avec le bouton X
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTicketSaleModal);
    }
    
    // Fermer le modal en cliquant en dehors
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeTicketSaleModal();
            }
        });
    }
}

function openTicketSaleModal() {
    const modal = document.getElementById('ticket-sale-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Réinitialiser le formulaire
        const form = document.getElementById('ticket-sale-form');
        if (form) {
            form.reset();
            document.getElementById('ticket-quantity').value = '';
            document.getElementById('ticket-price').value = '';
            document.getElementById('ticket-total').textContent = '0.00$';
            document.getElementById('ticket-offer-info').style.display = 'none';
            
            // Désactiver le bouton "Vendre les tickets"
            const addButton = document.getElementById('add-tickets-btn');
            if (addButton) {
                addButton.disabled = true;
            }
            
            // Désélectionner tous les boutons
            document.querySelectorAll('.offer-button').forEach(btn => {
                btn.classList.remove('selected');
            });
        }
    }
}

function closeTicketSaleModal() {
    const modal = document.getElementById('ticket-sale-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Charger les statistiques
async function loadStats() {
    try {
        const response = await fetch('/api/tickets/seller/stats', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erreur HTTP:', response.status, errorText);
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Réponse non-JSON reçue:', text.substring(0, 200));
            throw new Error('Réponse non-JSON reçue');
        }
        
        const stats = await response.json();
        
        // Afficher les statistiques
        document.getElementById('stat-total-tickets').textContent = stats.total?.tickets || 0;
        document.getElementById('stat-total-amount').textContent = (stats.total?.amount || 0).toFixed(2) + '$';
        document.getElementById('stat-today-tickets').textContent = stats.today?.tickets || 0;
        document.getElementById('stat-today-amount').textContent = (stats.today?.amount || 0).toFixed(2) + '$';
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
    }
}

// Afficher une notification de succès stylisée
function showSuccessNotification(quantity, email, ticketNumbers) {
    const notification = document.createElement('div');
    let notificationContent = `
        <div class="sale-notification-overlay"></div>
        <div class="sale-notification">
            <div class="sale-notification-header">
                <i class="fas fa-check-circle"></i>
                <h3>Vente complétée!</h3>
            </div>
            <div class="sale-notification-content">
                <p style="font-weight: 600; margin-bottom: 10px;">${quantity} ticket(s) vendu(s)</p>
                <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px;">${email}</p>
    `;
    
    if (ticketNumbers && ticketNumbers.length > 0) {
        notificationContent += `
                <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-weight: 600; margin-top: 15px; font-size: 0.9rem;">Numéros de tickets:</p>
                <p style="font-size: 0.85rem; color: #666; margin: 5px 0; word-break: break-all;">
                    ${ticketNumbers.join(', ')}
                </p>
        `;
    }
    
    notificationContent += `
                <p style="font-size: 0.85rem; color: #666; margin-top: 10px;">
                    <i class="fas fa-envelope"></i> Les numéros ont été envoyés par email
                </p>
            </div>
            <button class="sale-notification-button">OK</button>
        </div>
    `;
    
    notification.innerHTML = notificationContent;
    document.body.appendChild(notification);

    // Gérer la fermeture de la notification
    const closeNotification = () => {
        notification.remove();
    };

    notification.querySelector('.sale-notification-button').onclick = closeNotification;
    notification.querySelector('.sale-notification-overlay').onclick = closeNotification;
}

// Afficher une notification d'erreur stylisée
function showErrorNotification(message) {
    const errorNotification = document.createElement('div');
    errorNotification.innerHTML = `
        <div class="sale-notification-overlay"></div>
        <div class="sale-notification error">
            <div class="sale-notification-header">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Erreur</h3>
            </div>
            <div class="sale-notification-content">
                <p>${message}</p>
            </div>
            <button class="sale-notification-button">Fermer</button>
        </div>
    `;
    document.body.appendChild(errorNotification);

    const closeError = () => errorNotification.remove();
    errorNotification.querySelector('.sale-notification-button').onclick = closeError;
    errorNotification.querySelector('.sale-notification-overlay').onclick = closeError;
}

// Gérer la déconnexion
window.handleLogout = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        try {
            const response = await fetch('/auth/logout', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/login';
                } else {
                    window.location.href = '/login';
                }
            } else {
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            window.location.href = '/login';
        }
    }
};
