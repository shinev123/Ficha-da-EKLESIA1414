// Este arquivo tem a única responsabilidade de inicializar o Firebase.

const firebaseConfig = {
  apiKey: "AIzaSyDxHGcjB0ty8XPyd5Wk2-tqBu_R7FB8tdE",
  authDomain: "ficha-rpg-eklesia.firebaseapp.com",
  // LINHA ADICIONADA:
  databaseURL: "https://ficha-rpg-eklesia-default-rtdb.firebaseio.com", 
  projectId: "ficha-rpg-eklesia",
  storageBucket: "ficha-rpg-eklesia.appspot.com", // CORRIGI O NOME DO BUCKET AQUI
  messagingSenderId: "986040454734",
  appId: "1:986040454734:web:34a6041365c809ea357d1f",
  measurementId: "G-N736XPVGNX"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);