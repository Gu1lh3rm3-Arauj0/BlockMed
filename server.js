const { ethers } = require('ethers');
const { Wallet } = require('ethers');
const { abi, contractAddress } = require('./public/constants.js'); 

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();  // Carrega as variáveis de ambiente
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

let proposals = [];  // Armazena todas as propostas enviadas

app.get('/index.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.js'));
});


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
    res.render('laboratorios_pesquisa', { acceptedPatients, walletAddress: req.query.wallet || '' });
});


app.get('/clinicas', (req, res) => {
    res.render('clinicas', { patients, acceptedPatients });
});

app.get('/pacientes', (req, res) => {
    const wallet = req.query.wallet || '';

    // Busca a proposta correspondente à carteira do paciente
    const proposal = proposals.find(p => p.patients.includes(wallet));

    if (proposal) {
        res.render('pacientes', { wallet, proposal });
    } else {
        res.render('pacientes', { wallet, proposal: { labName: 'Nenhuma proposta encontrada', price: 0 } });
    }
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

app.post('/submit-exam', async (req, res) => {
    const { nome_lab, quantidade, preco, reason, walletAddress } = req.body;
    const proposalId = proposals.length + 1;
    proposals.push({
        id: proposalId,
        labName: nome_lab,
        price: preco,
        reason: reason,
        quantity: quantidade,
        patients: []  // Inicialmente, sem pacientes associados
    });

    try {
        // const balance = await provider.getBalance("0x5953DF4a70c9f4FC64C9016777Cb63d0e43dF98A");
        
        // console.log(`Saldo da conta: ${ethers.utils.formatEther(balance)} ETH`);

        const provider = new ethers.providers.JsonRpcProvider(process.env.INFURA_URL);


        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        const contract = new ethers.Contract(contractAddress, abi, wallet.connect(provider));

        // Converter o preço para wei (a menor unidade de ETH)
        const precoEmWei = ethers.utils.parseUnits(preco.toString(), 'ether');

        // Chamar a função do contrato inteligente
        const tx = await contract.sendProposal(
            ethers.BigNumber.from(quantidade),  // Quantidade de exames
            precoEmWei,  // Preço por exame em wei
            reason  // Tipo de exame
        );

        // Aguardar a confirmação da transação
        await tx.wait();
        console.log('Proposta de exame enviada com sucesso:', tx.hash);
        // Enviar uma resposta ao frontend indicando que a transação foi bem-sucedida
        res.json({ success: true, message: 'Proposta enviada com sucesso', txHash: tx.hash });
    } catch (error) {
        console.error('Erro ao enviar a proposta de exame:', error);
        // Enviar uma resposta ao frontend indicando que houve um erro
        res.json({ success: false, message: 'Erro ao enviar a proposta' });
}
});


// encerrar proposta
app.post('/close-proposal', (req, res) => {
    const { response_proposal } = req.body;
    // enviar essa resposta pro contrato
    console.log(`Resposta da proposta: ${response_proposal}`);
    
});


app.post('/associate-patient', (req, res) => {
    const { proposalId, patientWallet } = req.body;

    // Encontra a proposta pelo IDconst proposal = proposals.find(p => p.id === parseInt(proposalId));

    if (proposal) {
        // Adiciona o paciente à lista de pacientes associados à proposta
        proposal.patients.push(patientWallet);
        console.log(`Paciente com carteira ${patientWallet} associado à proposta ${proposalId}`);
        res.send(`Paciente associado com sucesso à proposta ${proposalId}`);
    } else {
        res.status(404).send('Proposta não encontrada');
    }
});