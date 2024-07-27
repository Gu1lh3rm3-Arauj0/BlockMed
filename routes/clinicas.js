const express = require('express');
const router = express.Router();
const path = require('path');

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'clinicas.html'));
});

// Envio de emails --> ainda não funciona
router.post('/send-emails', (req, res) => {
    const { selectedPatients } = req.body;
    // Integrar depois para enviar resposta ao contrato inteligente
    console.log({ selectedPatients });
    res.send('Emails enviado com sucesso!');
});

module.exports = router;