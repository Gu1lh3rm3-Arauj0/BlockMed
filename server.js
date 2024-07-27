const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Routes

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const userType = req.body.user_type;
    if (userType === 'laboratorios_pesquisa') {
        res.redirect('/laboratorios-pesquisa');
    } else if (userType === 'clinic') {
        res.redirect('/clinicas');
    } else if (userType === 'patient') {
        res.redirect('/pacientes');
    } else {
        res.send('Tipo de Usuário Inválido');
    }
});

app.get('/laboratorios-pesquisa', (req, res) => {
    res.render('laboratorios_pesquisa');
});

app.get('/clinicas', (req, res) => {
    res.render('clinicas');
});

app.get('/pacientes', (req, res) => {
    res.render('pacientes');
});

app.get('/pacientes', (req, res) => {
    const { Nome, preco } = req.query;
    res.render('pacientes', { Nome, preco });
});

// renderizar servidor 
app.listen(PORT, () => {
    console.log(`Servidor disponível em http://localhost:${PORT}`);
});
