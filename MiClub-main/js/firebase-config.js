// Importamos las funciones necesarias de Firebase usando los enlaces web (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Tu configuración exacta de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCbTwq3OIC4EW1K0g5mCpQ1WolTvk5_GjA",
  authDomain: "miclub-419ee.firebaseapp.com",
  projectId: "miclub-419ee",
  storageBucket: "miclub-419ee.firebasestorage.app",
  messagingSenderId: "954610361315",
  appId: "1:954610361315:web:a8ee4dabf98059125636d6",
  measurementId: "G-Q0WH4XPMZ4"
};

// Inicializamos la aplicación, la autenticación y la base de datos
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Exportamos 'auth' y 'db' para poder usarlos en los otros archivos
export { auth, db };