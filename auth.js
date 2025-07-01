document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const ADMIN_EMAIL = "vini@eklesia.com";

    const toastContainer = document.getElementById('toast-container');
    const showToast = (message, isError = false) => {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        if (isError) toast.style.borderLeftColor = '#c0392b';
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    // NOVA FUNÇÃO: Ativa o efeito de erro para usuário deletado
    const triggerDeletedUserEffect = () => {
        const overlay = document.getElementById('deleted-user-overlay');
        const cryptoRain = document.getElementById('crypto-rain');
        if (!overlay || !cryptoRain) return;

        // Esconde o formulário de login e mostra o overlay
        document.querySelector('.auth-container').classList.add('hidden');
        overlay.classList.remove('hidden');

        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':,.<>/?";
        const generateCryptoText = () => {
            let text = '';
            for (let i = 0; i < 5000; i++) {
                text += chars[Math.floor(Math.random() * chars.length)];
            }
            cryptoRain.textContent = text;
        };

        // Pisca o texto criptografado
        setInterval(generateCryptoText, 100);
    };


    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.toLowerCase();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (password !== confirmPassword) {
                return showToast("As senhas não coincidem!", true);
            }
            if (password.length < 6) {
                return showToast("A senha deve ter pelo menos 6 caracteres.", true);
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    // Cria o documento no Firestore
                    return db.collection("fichas").doc(user.uid).set({
                        email: user.email,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        characterData: {}
                    });
                })
                .then(() => {
                    showToast("Agente registrado com sucesso! Redirecionando...");
                    setTimeout(() => { window.location.href = './login.html'; }, 2000);
                })
                .catch(error => {
                    if (error.code === 'auth/email-already-in-use') {
                        showToast("Este email de agente já está registrado!", true);
                    } else {
                        showToast("Erro ao registrar: " + error.message, true);
                    }
                });
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.toLowerCase();
            const password = document.getElementById('password').value;

            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    const userDocRef = db.collection("fichas").doc(user.uid);

                    // NOVA LÓGICA: Verifica se o documento da ficha existe no Firestore
                    return userDocRef.get().then(doc => {
                        if (doc.exists) {
                            // A ficha existe, login normal
                            sessionStorage.setItem('loggedInUserEmail', user.email);
                            sessionStorage.setItem('loggedInUserId', user.uid);

                            if (user.email === ADMIN_EMAIL) {
                                showToast("Acesso de Mestre autorizado. Carregando painel...");
                                setTimeout(() => { window.location.href = './dashboard.html'; }, 1500);
                            } else {
                                showToast("Acesso autorizado. Carregando dossiê...");
                                setTimeout(() => { window.location.href = './index.html'; }, 1500);
                            }
                        } else {
                            // A ficha NÃO existe. Este usuário foi deletado pelo admin.
                            // Desloga o usuário imediatamente para limpar a sessão de autenticação.
                            auth.signOut();
                            // Ativa o efeito de erro.
                            triggerDeletedUserEffect();
                        }
                    });
                })
                .catch(error => {
                    // Trata erros de login (senha errada, usuário não existe, etc)
                    showToast("Email ou senha incorretos.", true);
                });
        });
    }
});