const TICKET_PRICE = 0.50; // Prix unitaire d'un coupon

document.addEventListener('DOMContentLoaded', () => {
    const quantityInput = document.getElementById('quantity');
    const totalAmount = document.getElementById('total-amount');
    const purchaseForm = document.getElementById('purchase-form');
    
    // Calculer le total quand la quantité change
    quantityInput.addEventListener('input', () => {
        const quantity = parseInt(quantityInput.value) || 0;
        const total = quantity * TICKET_PRICE;
        totalAmount.textContent = total.toFixed(2) + '$';
    });
    
    // Gérer la soumission du formulaire
    purchaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const quantity = parseInt(document.getElementById('quantity').value);
        const paymentMethod = document.getElementById('payment-method').value;
        const total = quantity * TICKET_PRICE;
        
        // Désactiver le bouton
        const submitBtn = purchaseForm.querySelector('button[type="submit"]');
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
                    totalAmount: total,
                    paymentMethod
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Afficher le message de succès
                showSuccessMessage(data.tickets, email);
                // Réinitialiser le formulaire
                purchaseForm.reset();
                totalAmount.textContent = '0.50$';
            } else {
                showError(data.message || 'Erreur lors de l\'achat');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showError('Erreur de connexion. Veuillez réessayer.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Acheter les coupons';
        }
    });
});

function showSuccessMessage(ticketNumbers, email) {
    const successDiv = document.getElementById('success-message');
    const ticketsDiv = document.getElementById('ticket-numbers');
    
    ticketsDiv.innerHTML = '<p style="margin-bottom: 10px; font-weight: 600;">Vos numéros de coupons :</p>';
    ticketNumbers.forEach(num => {
        const ticketSpan = document.createElement('span');
        ticketSpan.className = 'ticket-number';
        ticketSpan.textContent = num;
        ticketsDiv.appendChild(ticketSpan);
    });
    
    ticketsDiv.innerHTML += `<p style="margin-top: 15px; color: var(--text-light); font-size: 0.9rem;">Les numéros ont également été envoyés à : ${email}</p>`;
    
    successDiv.style.display = 'block';
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Masquer le formulaire
    document.querySelector('.tickets-content').style.display = 'none';
}

function showError(message) {
    let errorDiv = document.querySelector('.error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        document.querySelector('.purchase-section').insertBefore(errorDiv, document.querySelector('.purchase-section h2').nextSibling);
    }
    
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}
