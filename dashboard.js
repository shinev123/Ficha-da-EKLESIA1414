document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        const ADMIN_EMAIL = "vini@eklesia.com";

        if (user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            const sheetListContainer = document.getElementById('sheet-list-container');
            const liveRollFeed = document.getElementById('live-roll-feed');
            const logoutBtn = document.getElementById('logout-btn');
            const db = firebase.firestore();
            const rtdb = firebase.database(); // Referência ao Realtime Database

            const bagTypes = [ { name: 'Leve', capacity: 15 }, { name: 'Média', capacity: 25 }, { name: 'Pesada', capacity: 35 } ];
            const messageModal = document.getElementById('message-modal');
            const messageForm = document.getElementById('message-form');
            const messageModalTitle = document.getElementById('message-modal-title');
            const messageTargetIdInput = document.getElementById('message-target-id');
            const messageTextInput = document.getElementById('message-text');
            
            let agentStatusCache = {}; // Cache para saber o status anterior
            let agentNames = {}; // Cache para guardar os nomes dos agentes para as notificações

            const showToast = (message, isError = false) => {
                const toastContainer = document.getElementById('toast-container');
                if (!toastContainer) return;
                const toast = document.createElement('div');
                toast.className = 'toast';
                if (isError) toast.style.borderLeftColor = '#c0392b';
                toast.textContent = message;
                toastContainer.appendChild(toast);
                setTimeout(() => { toast.classList.add('fade-out'); toast.addEventListener('animationend', () => toast.remove()); }, 5000);
            };

            const openModal = (modalElement) => { modalElement.style.display = 'flex'; setTimeout(() => modalElement.classList.add('active'), 10); };
            const closeModal = (modalElement) => { modalElement.classList.remove('active'); setTimeout(() => { if(modalElement) modalElement.style.display = 'none'; }, 300); };

            const setupPresenceListener = () => {
                const statusRef = rtdb.ref('status');
                statusRef.on('value', (snapshot) => {
                    const statuses = snapshot.val() || {};
                    for (const userId in statuses) {
                        const indicator = document.getElementById(`status-${userId}`);
                        if (indicator) {
                            const currentState = statuses[userId].state;
                            const previousState = agentStatusCache[userId];

                            indicator.className = `status-indicator ${currentState}`;
                            indicator.title = currentState === 'online' ? 'Online' : 'Offline';

                            if (currentState === 'online' && previousState !== 'online') {
                                const agentName = agentNames[userId] || 'Um agente';
                                showToast(`A ficha de ${agentName} está sendo acessada.`);
                            }
                            
                            agentStatusCache[userId] = currentState;
                        }
                    }
                });
            };

            const setupRealtimeListener = () => {
                sheetListContainer.innerHTML = '<div class="empty-state">Sincronizando dossiês de agentes...</div>';

                db.collection("fichas").orderBy("createdAt", "desc").onSnapshot(querySnapshot => {
                    sheetListContainer.innerHTML = ''; 
                    agentNames = {};

                    if (querySnapshot.docs.length <= 1 && querySnapshot.docs[0]?.data().email === ADMIN_EMAIL) {
                         sheetListContainer.innerHTML = '<div class="empty-state">[ NENHUM AGENTE REGISTRADO ]</div>';
                         return;
                    }

                    querySnapshot.forEach(doc => {
                        const sheetData = doc.data();
                        if (sheetData.email === ADMIN_EMAIL) return; 

                        const sheetId = doc.id;
                        const charData = sheetData.characterData || {};
                        const charName = charData.name || sheetData.email;
                        agentNames[sheetId] = charName;

                        const lastModified = charData.lastModified;
                        const status = charData.status || {};
                        const hp = status.hp || { current: 'N/A', max: 'N/A' };
                        const money = charData.money || 0;
                        const equipment = charData.equipment || [];
                        const currentWeight = equipment.reduce((total, item) => {
                            let itemWeightInKg = parseFloat(item.weight) || 0;
                            if (item.unit === 'g') { itemWeightInKg /= 1000; }
                            return total + itemWeightInKg;
                        }, 0);
                        const selectedBagName = charData.selectedBag || 'Leve';
                        const selectedBag = bagTypes.find(b => b.name === selectedBagName) || bagTypes[0];
                        const isOverloaded = currentWeight > selectedBag.capacity;

                        let overloadAlert = isOverloaded ? `<div class="agent-alert overload"><i class="fas fa-exclamation-triangle"></i> CARGA EXCEDIDA</div>` : '';
                        let peAlert = (status.pe?.current === 0) ? `<div class="agent-alert pe-zero"><i class="fas fa-exclamation-triangle"></i> VIGOR ESGOTADO</div>` : '';
                        let sanAlert = (status.san?.current === 0) ? `<div class="agent-alert san-zero"><i class="fas fa-exclamation-triangle"></i> SACRATA ESGOTADA</div>` : '';

                        // *** LINHA CORRIGIDA ABAIXO ***
                        const initialStatus = agentStatusCache[sheetId] || 'offline';

                        const sheetCard = document.createElement('div');
                        sheetCard.className = 'detailed-item agent-card';
                        sheetCard.dataset.id = sheetId;
                        
                        sheetCard.innerHTML = `
                            <div class="agent-card-header">
                                <div class="status-indicator ${initialStatus}" id="status-${sheetId}" title="${initialStatus}"></div>
                                <i class="fas fa-user-secret agent-icon"></i>
                                <div class="agent-info">
                                    <h4>${charName}</h4>
                                    <div class="item-cost">Email: ${sheetData.email}</div>
                                </div>
                            </div>
                            <div class="agent-stats-grid">
                                <div class="agent-stat"> <i class="fas fa-heartbeat"></i> <span>${hp.current} / ${hp.max}</span> </div>
                                <div class="agent-stat"> <i class="fas fa-dollar-sign"></i> <span>$${money.toFixed(2)}</span> </div>
                                ${overloadAlert} ${peAlert} ${sanAlert}
                            </div>
                            <p class="sync-info">Última Sincronização: ${lastModified ? new Date(lastModified.seconds * 1000).toLocaleString('pt-BR') : 'Nenhuma'}</p>
                            <div class="item-actions">
                                <button class="btn-action use" data-action="load" data-id="${sheetId}"><i class="fas fa-folder-open"></i> Carregar Ficha</button>
                                <button class="btn-action edit" data-action="send-message" data-id="${sheetId}" data-name="${charName}"><i class="fas fa-paper-plane"></i> Mensagem</button>
                                <button class="btn-action delete" data-action="delete" data-id="${sheetId}" data-email="${sheetData.email}"><i class="fas fa-user-times"></i> Deletar Agente</button>
                            </div>
                        `;
                        sheetListContainer.appendChild(sheetCard);
                    });
                }, error => {
                    console.error("Erro ao carregar lista de agentes: ", error);
                    sheetListContainer.innerHTML = '<div class="empty-state">Erro de conexão com a lista de agentes.</div>';
                });
            };

            const setupLiveRollFeedListener = () => {
                const liveRollFeed = document.getElementById('live-roll-feed');
                if (!liveRollFeed) return;
                db.collection('rolagens_globais').orderBy('timestamp', 'desc').limit(20)
                    .onSnapshot(snapshot => {
                        if (snapshot.empty) { liveRollFeed.innerHTML = '<div class="empty-state">Aguardando rolagens dos agentes...</div>'; return; }
                        liveRollFeed.innerHTML = '';
                        snapshot.docs.forEach(doc => {
                            const rollData = doc.data();
                            const timestamp = rollData.timestamp ? rollData.timestamp.toDate().toLocaleTimeString() : 'agora';
                            const rollHtml = rollData.rollString.replace(/🎲 \d+/g, '<span class="dice-value">$&</span>').replace(/= \d+/g, '<span class="final-total">$&</span>');
                            const rollEntry = document.createElement('div');
                            rollEntry.className = 'dice-history-item';
                            rollEntry.innerHTML = `<div><span class="timestamp">[${timestamp}]</span> <strong>${rollData.characterName}</strong> <span class="result-title">${rollData.rollType}</span></div><div style="padding-left: 15px; white-space: pre-wrap;">${rollHtml}</div>`;
                            liveRollFeed.appendChild(rollEntry);
                        });
                    }, error => { console.error("Erro no feed de rolagens: ", error); if (liveRollFeed) liveRollFeed.innerHTML = '<div class="empty-state">Erro de conexão com o feed.</div>'; });
            };

            sheetListContainer.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]'); if (!target) return;
                const { action, id, email, name } = target.dataset;
                if (action === 'load') { sessionStorage.setItem('sheetToEdit', id); window.location.href = 'index.html'; } 
                else if (action === 'send-message') { messageModalTitle.textContent = `Enviar Mensagem para ${name}`; messageTargetIdInput.value = id; messageTextInput.value = ''; openModal(messageModal); }
                else if (action === 'delete') { const confirmationMessage = `Você tem certeza que deseja DELETAR PERMANENTEMENTE a ficha do agente "${email}"?\n\nEsta ação não pode ser desfeita.`; if (confirm(confirmationMessage)) { db.collection('fichas').doc(id).delete().then(() => { showToast(`Ficha de "${email}" deletada com sucesso.`); setTimeout(() => { showToast(`LEMBRETE: Para remover o login, delete "${email}" na aba 'Authentication' do Firebase.`, true); }, 1000); }).catch(error => { console.error("Erro ao deletar ficha: ", error); showToast("Ocorreu um erro ao deletar a ficha.", true); }); } }
            });

            messageForm.addEventListener('submit', (e) => { e.preventDefault(); const targetUserId = messageTargetIdInput.value; const message = messageTextInput.value.trim(); if (!message) { showToast("A mensagem não pode estar vazia.", true); return; } db.collection('messages').add({ targetUserId: targetUserId, message: message, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(() => { showToast("Mensagem enviada com sucesso!"); closeModal(messageModal); }).catch(error => { console.error("Erro ao enviar mensagem:", error); showToast("Falha ao enviar a mensagem.", true); }); });
            messageModal.addEventListener('click', (e) => { if (e.target === messageModal || e.target.closest('.close-btn')) { closeModal(messageModal); } });
            logoutBtn.addEventListener('click', () => { firebase.auth().signOut().then(() => { sessionStorage.clear(); window.location.href = 'login.html'; }); });

            setupRealtimeListener();
            setupLiveRollFeedListener();
            setupPresenceListener();

        } else {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    });
});