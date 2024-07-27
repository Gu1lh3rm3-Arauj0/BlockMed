const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'laboratorios_pesquisa.html'));
});

// Submissão do form
router.post('/submit', (req, res) => {
    const { quantidade, valor, razao, prazo, tipo, nome } = req.body;
    // Integrar depois para enviar resposta ao contrato inteligente
    console.log({ quantidade, valor, razao, prazo, tipo, nome });
    res.send('Form submitted!');
});

module.exports = router;