const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();  // Carrega as variáveis de ambiente
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// renderizar servidor 
app.listen(PORT, () => {
    console.log(`Servidor disponível em http://localhost:${PORT}`);
});

// Email credentials
const emailSender = process.env.EMAIL_SENDER;
const emailPassword = process.env.EMAIL_PASSWORD;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

let patients = []; // Array para armazenar todos os pacientes
const acceptedPatients = []; // Array para armazenar os pacientes aceitos

// Email transporter
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, 
    secure: true,
    auth: {
        user: emailSender,
        pass: emailPassword
    }
});

// Routes

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const userType = req.body.user_type;
    if (userType === 'research_institution') {
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
    res.render('laboratorios_pesquisa', { acceptedPatients });
});

app.get('/clinicas', (req, res) => {
    res.render('clinicas', { patients, acceptedPatients });
});

app.get('/pacientes', (req, res) => {
    const wallet = req.query.wallet || '';
    
    // Exemplo de dados para proposta - substituir após integração com os contratos Inteligentes
    const proposal = {
        labName: 'Lab Example',
        price: 100  // por enquanto, só um exemplo
    };

    res.render('pacientes', { wallet, proposal });
});

app.post('/new-patient', (req, res) => {
    const { patientName, patientWalletId, patientEmail } = req.body;
    patients.push({ name: patientName, wallet: patientWalletId, email: patientEmail });
    res.redirect('/clinicas');
});

app.post('/send-email', (req, res) => {
    patients.forEach(patient => {
        const mailOptions = {
            from: emailSender,
            to: patient.email,
            subject: "Nova Proposta BlockMed",
            text: `Você recebeu uma nova proposta para seu exame. Por favor acesse: http://localhost:3000/pacientes?wallet=${patient.wallet}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Erro no envio de email:', error);
            } else {
                console.log('Email enviado: ' + info.response);
            }
        });
    });

    res.redirect('/clinicas');
});

app.post('/send-doc', (req, res) => {
    // Lógica para enviar documentos via drive --> temos que achar um jeito de criptografar os arquivos
    res.redirect('/clinicas');
});

// Endpoint para atualizar a lista de aceitos --> conectar com contrato inteligente
app.post('/accept-patient', (req, res) => {
    const { wallet } = req.body;
    const patient = patients.find(p => p.wallet === wallet);
    if (patient) {
        acceptedPatients.push(patient);
        patients = patients.filter(p => p.wallet !== wallet);
    }
    res.redirect('/clinicas');
});

// Lógicas para tornar a página de Usuários com UX Design melhor
app.post('/edit-patient', (req, res) => {
    const { walletId, patientName, patientEmail } = req.body;
    const patient = patients.find(p => p.wallet === walletId);
    if (patient) {
        patient.name = patientName;
        patient.email = patientEmail;
    }
    res.redirect('/clinicas');
});

app.post('/delete-patient', (req, res) => {
    const { wallet } = req.body;
    patients = patients.filter(p => p.wallet !== wallet);
    res.redirect('/clinicas');
});

// enviar exame  --> por enquanto tá só mostrando as informações no console, mas precisa integrar com o contrato inteligente
app.post('/submit-exam', (req, res) => {
    const { Nome, quantidade, preco, tipo_exame, deadline } = req.body;

    console.log(`Nome do Laboratório: ${Nome}`);
    console.log(`Quantidade: ${quantidade}`);
    console.log(`Preço por teste: ${preco}`);
    console.log(`Tipo de Exame: ${tipo_exame}`);
    console.log(`Prazo para aceitação: ${deadline} dias`);
    res.redirect('/laboratorios-pesquisa');
});

