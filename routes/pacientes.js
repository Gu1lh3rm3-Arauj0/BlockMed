const express = require('express');
const router = express.Router();
const path = require('path');

// pacientes
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views', 'pacientes.html'));
});

router.post('/respond', (req, res) => {
    const { response, patientId } = req.body;
    // Integrar depois para enviar resposta ao contrato inteligente
    console.log({ response, patientId });
    res.send('Resposta armazenada!');
});

module.exports = router;